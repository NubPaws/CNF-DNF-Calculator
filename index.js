
function isWhiteSpace(input, i) {
  return /\s/.test(input[i]);
}

function isParenthesis(input, i) {
  return input[i] === '(' || input[i] === ')';
}

function isImpliedOperator(input, i) {
  if (input[i] !== '-')
    return false;
  
  const check = input.slice(i, i + 2);
  return check === "->" || check === "=>";
}

function isIfAndOnlyIfOperator(input, i) {
  if (input[i] !== '<')
    return false;
  
  const check = input.slice(i, i + 3);
  return check === "<->" || check === "<=>";
}

function tokenize(input) {
  let tokens = [];
  let i = 0;
  
  while (i < input.length) {
    
    if (isWhiteSpace(input, i)) {
      i++;
      continue;
    }
    
    if (isParenthesis(input, i)) {
      tokens.push({ type: 'paren', value: input[i] });
      i++;
      continue;
    }
    
    // Check if the character is one of the following operators.
    if (input[i] === '~' || input[i] === '&' || input[i] === '|') {
      tokens.push({ type: 'operator', value: input[i] });
      i++;
      continue;
    }
    
    if (isImpliedOperator(input, i)) {
      tokens.push({ type: 'operator', value: '->' });
      i += 2;
      continue;
    }
    
    if (isIfAndOnlyIfOperator(input, i)) {
      tokens.push({ type: 'operator', value: '<->' });
      i += 3;
      continue;
    }
    
    // Check if we have a variable that can be made with a letter at the start and
    // then have any combination of letters, numbers and underscore.
    if (/[A-Za-z]/.test(input[i])) {
      let varName = "";
      
      // Keep reading until we don't have a letter, number or underscore.
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

// Simple recursive descent parser to build an AST.
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  
  peek() {
    return this.tokens[this.pos];
  }
  
  consume(expected) {
    let token = this.tokens[this.pos];
    
    if (!token) {
      throw new Error(`Unexpected end of input, expected "${expected}"`);
    }
    if (expected && token.value !== expected) {
      throw new Error(`Expected token "${expected}" but found "${token.value}"`);
    }
    
    this.pos++;
    return token;
  }
}

function parseExpression(tokens) {
  let parser = new Parser(tokens);
  let expr = parseIfAndOnlyIf(parser);
  
  if (parser.pos < parser.tokens.length) {
    throw new Error("Unexpected token: " + parser.tokens[parser.pos].value);
  }
  return expr;
}

// Parse equivalence (<->) — lowest precedence.
function parseIfAndOnlyIf(parser) {
  let left = parseImplies(parser);
  while (parser.pos < parser.tokens.length &&
         parser.tokens[parser.pos].type === 'operator' &&
         parser.tokens[parser.pos].value === '<->') {
    parser.consume('<->');
    let right = parseImplies(parser);
    left = { type: 'equiv', left: left, right: right };
  }
  return left;
}

// Parse implication (->).
function parseImplies(parser) {
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

// Parse OR (|).
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

// Parse AND (&).
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

// Parse NOT (~) (unary).
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
    let expr = parseIfAndOnlyIf(parser);
    if (parser.tokens[parser.pos] && parser.tokens[parser.pos].type === 'paren' && parser.tokens[parser.pos].value === ')') {
      parser.consume(')');
    } else {
      throw new Error("Expected ')'");
    }
    return expr;
  }
  throw new Error("Unexpected token: " + token.value);
}

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

// Extracts a sorted list of variable names from the AST.
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

function generateTableAndNF() {
  const input = document.getElementById("expr").value;
  try {
    // Tokenize and parse the expression into an AST.
    const tokens = tokenize(input);
    const ast = parseExpression(tokens);
    // Get all variables used in the expression.
    const variables = getVariables(ast);
    
    // Begin building the truth table.
    let tableHTML = "<table><thead><tr>";
    variables.forEach(v => {
      tableHTML += "<th>" + v + "</th>";
    });
    tableHTML += "<th>" + input + "</th>";
    tableHTML += "</tr></thead><tbody>";
    
    const numRows = Math.pow(2, variables.length);
    // Arrays to collect the clauses for DNF and CNF.
    let dnfClauses = [];
    let cnfClauses = [];
    
    /**
     * Use a binary string to represent each line like so:
     * p, q, r
     * 1  0  1
     */
    for (let i = numRows - 1; i >= 0; i--) {
      const assignment = {};
      for (let j = 0; j < variables.length; j++) {
        // The msb corresponds to the first variable.
        assignment[variables[j]] = Boolean((i >> (variables.length - j - 1)) & 1);
      }
      const result = evaluateAST(ast, assignment);
      
      // Build the table row.
      tableHTML += "<tr>";
      variables.forEach(v => {
        tableHTML += "<td>" + (assignment[v] ? "T" : "F") + "</td>";
      });
      tableHTML += "<td>" + (result ? "T" : "F") + "</td>";
      tableHTML += "</tr>";
      
      // For DNF: For each row where the formula is true, build a conjunction clause.
      if (result) {
        let parts = [];
        for (let v of variables) {
          parts.push(assignment[v] ? v : "~" + v);
        }
        let clause = parts.join(" ∧ ");
        if (parts.length > 1) {
          clause = "(" + clause + ")";
        }
        dnfClauses.push(clause);
      } else {
        // For CNF: For each row where the formula is false, build a disjunction clause.
        let parts = [];
        for (let v of variables) {
          // Note: Reverse the literal—if the variable is true, include its negation; if false, include the variable.
          parts.push(assignment[v] ? "~" + v : v);
        }
        let clause = parts.join(" ∨ ");
        if (parts.length > 1) {
          clause = "(" + clause + ")";
        }
        cnfClauses.push(clause);
      }
    }
    tableHTML += "</tbody></table>";
    
    // Construct the overall DNF and CNF.
    let dnf = dnfClauses.length > 0 ? dnfClauses.join(" ∨ ") : "False";
    let cnf = cnfClauses.length > 0 ? cnfClauses.join(" ∧ ") : "True";
    
    // Combine the truth table and the normal forms for display.
    let resultHTML = tableHTML;
    resultHTML += "<div class='normal-forms'>";
    resultHTML += "<p><strong>DNF:</strong> " + dnf + "</p>";
    resultHTML += "<p><strong>CNF:</strong> " + cnf + "</p>";
    resultHTML += "</div>";
    
    document.getElementById("result").innerHTML = resultHTML;
  } catch (e) {
    document.getElementById("result").innerHTML = "<p class='error'>Error: " + e.message + "</p>";
  }
}

document.getElementById("generate").addEventListener("click", generateTableAndNF);

/**
 * Keys handler for auto completing parenthesis and for automatically
 * submitting the statement when pressing the enter key.
 */
document.getElementById("expr").addEventListener("keydown", (event) => {
  const input = event.target;
  
  if (event.key === "(") {
    event.preventDefault();
    
    const start = input.selectionStart;
    const end = input.selectionEnd;
    
    input.value = input.value.slice(0, start) + "(" + input.value.slice(start, end) + ")" + input.value.slice(end);
    input.selectionStart = start + 1;
    input.selectionEnd = end + 1;
    return;
  }
  
  if (event.key === "Enter") {
    generateTableAndNF();
    return;
  }
  
});
