// ------------------------
// Tokenizer: Converts input string into tokens
// ------------------------
function tokenize(input) {
  let tokens = [];
  let i = 0;
  while (i < input.length) {
    // Skip whitespace
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }
    // Parentheses
    if (input[i] === '(' || input[i] === ')') {
      tokens.push({ type: 'paren', value: input[i] });
      i++;
      continue;
    }
    // Single-character operators: ~, &, |
    if (input[i] === '~' || input[i] === '&' || input[i] === '|') {
      tokens.push({ type: 'operator', value: input[i] });
      i++;
      continue;
    }
    // Multi-character operators: -> and <-> 
    if (input[i] === '-' && input.slice(i, i+2) === '->') {
      tokens.push({ type: 'operator', value: '->' });
      i += 2;
      continue;
    }
    if (input[i] === '<' && input.slice(i, i+3) === '<->') {
      tokens.push({ type: 'operator', value: '<->' });
      i += 3;
      continue;
    }
    // Variables (letters, optionally with digits/underscores)
    if (/[A-Za-z]/.test(input[i])) {
      let varName = "";
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        varName += input[i];
        i++;
      }
      tokens.push({ type: 'variable', value: varName });
      continue;
    }
    throw new Error("Unknown token at position " + i + ": '" + input[i] + "'");
  }
  return tokens;
}

// ------------------------
// Parser: Recursive descent parser to build an AST
// ------------------------
function Parser(tokens) {
  this.tokens = tokens;
  this.pos = 0;
}

Parser.prototype.peek = function() {
  return this.tokens[this.pos];
};

Parser.prototype.consume = function(expected) {
  let token = this.tokens[this.pos];
  if (!token) {
    throw new Error("Unexpected end of input, expected '" + expected + "'");
  }
  if (expected && token.value !== expected) {
    throw new Error("Expected token '" + expected + "' but found '" + token.value + "'");
  }
  this.pos++;
  return token;
};

// parseExpression is our entry point
function parseExpression(tokens) {
  let parser = new Parser(tokens);
  let expr = parseEquiv(parser);
  if (parser.pos < parser.tokens.length) {
    throw new Error("Unexpected token: " + parser.tokens[parser.pos].value);
  }
  return expr;
}

// Parse equivalence (<->) — lowest precedence
function parseEquiv(parser) {
  let left = parseImplication(parser);
  while (parser.pos < parser.tokens.length &&
          parser.tokens[parser.pos].type === 'operator' &&
          parser.tokens[parser.pos].value === '<->') {
    parser.consume('<->');
    let right = parseImplication(parser);
    left = { type: 'equiv', left: left, right: right };
  }
  return left;
}

// Parse implication (->)
function parseImplication(parser) {
  let left = parseOr(parser);
  while (parser.pos < parser.tokens.length &&
          parser.tokens[parser.pos].type === 'operator' &&
          parser.tokens[parser.pos].value === '->') {
    parser.consume('->');
    let right = parseOr(parser);
    left = { type: 'implies', left: left, right: right };
  }
  return left;
}

// Parse OR (|)
function parseOr(parser) {
  let left = parseAnd(parser);
  while (parser.pos < parser.tokens.length &&
          parser.tokens[parser.pos].type === 'operator' &&
          parser.tokens[parser.pos].value === '|') {
    parser.consume('|');
    let right = parseAnd(parser);
    left = { type: 'or', left: left, right: right };
  }
  return left;
}

// Parse AND (&)
function parseAnd(parser) {
  let left = parseNot(parser);
  while (parser.pos < parser.tokens.length &&
          parser.tokens[parser.pos].type === 'operator' &&
          parser.tokens[parser.pos].value === '&') {
    parser.consume('&');
    let right = parseNot(parser);
    left = { type: 'and', left: left, right: right };
  }
  return left;
}

// Parse NOT (~) (unary)
function parseNot(parser) {
  if (parser.pos < parser.tokens.length &&
      parser.tokens[parser.pos].type === 'operator' &&
      parser.tokens[parser.pos].value === '~') {
    parser.consume('~');
    let operand = parseNot(parser);
    return { type: 'not', operand: operand };
  } else {
    return parsePrimary(parser);
  }
}

// Parse primary expressions: variables or parenthesized expressions
function parsePrimary(parser) {
  let token = parser.tokens[parser.pos];
  if (!token) {
    throw new Error("Unexpected end of input");
  }
  if (token.type === 'variable') {
    parser.consume();
    return { type: 'var', value: token.value };
  }
  if (token.type === 'paren' && token.value === '(') {
    parser.consume('(');
    let expr = parseEquiv(parser);
    if (parser.tokens[parser.pos] && parser.tokens[parser.pos].type === 'paren' && parser.tokens[parser.pos].value === ')') {
      parser.consume(')');
    } else {
      throw new Error("Expected ')'");
    }
    return expr;
  }
  throw new Error("Unexpected token: " + token.value);
}

// ------------------------
// Evaluator: Computes the truth value of the AST for a given variable assignment
// ------------------------
function evaluateAST(ast, vars) {
  switch (ast.type) {
    case 'var':
      return vars[ast.value];
    case 'not':
      return !evaluateAST(ast.operand, vars);
    case 'and':
      return evaluateAST(ast.left, vars) && evaluateAST(ast.right, vars);
    case 'or':
      return evaluateAST(ast.left, vars) || evaluateAST(ast.right, vars);
    case 'implies':
      return (!evaluateAST(ast.left, vars)) || evaluateAST(ast.right, vars);
    case 'equiv':
      return evaluateAST(ast.left, vars) === evaluateAST(ast.right, vars);
    default:
      throw new Error("Unknown AST node type: " + ast.type);
  }
}

// ------------------------
// Helper: Extract a sorted list of variable names from the AST
// ------------------------
function getVariables(ast) {
  let vars = new Set();
  function traverse(node) {
    switch (node.type) {
      case 'var':
        vars.add(node.value);
        break;
      case 'not':
        traverse(node.operand);
        break;
      case 'and':
      case 'or':
      case 'implies':
      case 'equiv':
        traverse(node.left);
        traverse(node.right);
        break;
    }
  }
  traverse(ast);
  return Array.from(vars).sort();
}

// ------------------------
// Generate the truth table and display it
// ------------------------
function generateTruthTable() {
  const input = document.getElementById("expr").value;
  try {
    // Tokenize and parse the expression into an AST
    const tokens = tokenize(input);
    const ast = parseExpression(tokens);
    // Get all variables used in the expression
    const variables = getVariables(ast);
    let tableHTML = "<table><thead><tr>";
    // Header row: one column per variable + one for the expression result
    variables.forEach(v => {
      tableHTML += "<th>" + v + "</th>";
    });
    tableHTML += "<th>" + input + "</th>";
    tableHTML += "</tr></thead><tbody>";
    // Total number of rows = 2^(number of variables)
    const numRows = Math.pow(2, variables.length);
    for (let i = 0; i < numRows; i++) {
      const assignment = {};
      // Create a truth assignment (using binary representation)
      for (let j = 0; j < variables.length; j++) {
        // The most significant bit corresponds to the first variable
        assignment[variables[j]] = Boolean((i >> (variables.length - j - 1)) & 1);
      }
      const result = evaluateAST(ast, assignment);
      tableHTML += "<tr>";
      variables.forEach(v => {
        tableHTML += "<td>" + (assignment[v] ? "T" : "F") + "</td>";
      });
      tableHTML += "<td>" + (result ? "T" : "F") + "</td>";
      tableHTML += "</tr>";
    }
    tableHTML += "</tbody></table>";
    document.getElementById("result").innerHTML = tableHTML;
  } catch (e) {
    document.getElementById("result").innerHTML = "<p class='error'>Error: " + e.message + "</p>";
  }
}

document.getElementById("generate").addEventListener("click", generateTruthTable);