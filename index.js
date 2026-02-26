/**
 * @typedef {"paren" | "operator" | "variable"} TokenType
 */

/**
 * @typedef {Object} Token
 * @property {TokenType} type
 * @property {string} value
 */

/**
 * @typedef {{type: "var", value: string}} VarNode
 * @typedef {{type: "not", operand: ASTNode}} NotNode
 * @typedef {{type: "and" | "or" | "implies" | "equiv", left: ASTNode, right: ASTNode}} BinaryNode
 * @typedef {VarNode | NotNode | BinaryNode} ASTNode
 */

/** @type {{or: " ∨ ", and: " ∧ ", implies: " -> ", equiv: " <-> ", not: "¬"}} */
const symbols = {
  or: ' ∨ ',
  and: ' ∧ ',
  implies: ' -> ',
  equiv: ' <-> ',
  not: '¬',
};

/**
 * Checks if the character at position `i` in the input is whitespace.
 *
 * @param {string} input - The input string.
 * @param {number} i - The index to check.
 * @returns {boolean} Whether the character is whitespace.
 */
function isWhiteSpace(input, i) {
  return /\s/.test(input[i]);
}

/**
 * Checks if the character at position `i` in the input is a parenthesis.
 *
 * @param {string} input - The input string.
 * @param {number} i - The index to check.
 * @returns {boolean} Whether the character is `(` or `)`.
 */
function isParenthesis(input, i) {
  return input[i] === '(' || input[i] === ')';
}

/**
 * Checks if the characters starting at position `i` form an implication operator (`->` or `=>`).
 *
 * @param {string} input - The input string.
 * @param {number} i - The index to check.
 * @returns {boolean} Whether an implication operator starts at this position.
 */
function isImpliedOperator(input, i) {
  if (input[i] !== '-' && input[i] !== '=') return false;

  const check = input.slice(i, i + 2);
  return check === '->' || check === '=>';
}

/**
 * Checks if the characters starting at position `i` form a biconditional operator (`<->` or `<=>`).
 *
 * @param {string} input - The input string.
 * @param {number} i - The index to check.
 * @returns {boolean} Whether a biconditional operator starts at this position.
 */
function isIfAndOnlyIfOperator(input, i) {
  if (input[i] !== '<') return false;

  const check = input.slice(i, i + 3);
  return check === '<->' || check === '<=>';
}

/**
 * Checks if the character at position `i` is a negation operator (`~`, `!`, or `¬`).
 *
 * @param {string} input - The input string.
 * @param {number} i - The index to check.
 * @returns {boolean} Whether the character is a negation operator.
 */
function isNotOperator(input, i) {
  return input[i] === '~' || input[i] === '!' || input[i] === '¬';
}

/**
 * Checks if the character at position `i` is a conjunction operator (`&`).
 *
 * @param {string} input - The input string.
 * @param {number} i - The index to check.
 * @returns {boolean} Whether the character is a conjunction operator.
 */
function isAndOperator(input, i) {
  return input[i] === '&' || input[i] === '∧';
}

/**
 * Checks if the character at position `i` is a disjunction operator (`|`).
 *
 * @param {string} input - The input string.
 * @param {number} i - The index to check.
 * @returns {boolean} Whether the character is a disjunction operator.
 */
function isOrOperator(input, i) {
  return input[i] === '|' || input[i] === '∨';
}

function isStartOfVariable(input, i) {
  return /[A-Za-z]/.test(input[i]);
}

function getVarName(input, i) {
  let varName = '';

  // Keep reading until we don't have a letter, number or underscore.
  while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
    varName += input[i];
    i++;
  }

  return varName;
}

/**
 * Tokenizes a logical expression string into an array of tokens.
 *
 * @param {string} input - The logical expression string to tokenize.
 * @returns {Token[]} The array of parsed tokens.
 * @throws {Error} If an unknown character is encountered.
 */
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

    if (
      isNotOperator(input, i) ||
      isAndOperator(input, i) ||
      isOrOperator(input, i)
    ) {
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
    if (isStartOfVariable(input, i)) {
      const varName = getVarName(input, i);
      tokens.push({ type: 'variable', value: varName });
      i += varName.length;
      continue;
    }
    throw new Error('Unknown token at position ' + i + ": '" + input[i] + "'");
  }
  return tokens;
}

/** Simple recursive descent parser to build an AST from a token array. */
class Parser {
  /**
   * @param {Token[]} tokens - The tokens to parse.
   */
  constructor(tokens) {
    /** @type {Token[]} */
    this.tokens = tokens;
    /** @type {number} */
    this.pos = 0;
  }

  /**
   * Returns the current token without advancing the position.
   *
   * @returns {Token | undefined} The current token, or `undefined` if at end.
   */
  peek() {
    return this.tokens[this.pos];
  }

  /**
   * Returns the current token and advances the position by one.
   *
   * @returns {Token | undefined} The consumed token, or `undefined` if at end.
   */
  pop() {
    return this.tokens[this.pos++];
  }

  /**
   * Checks whether all tokens have been consumed.
   *
   * @returns {boolean} `true` if there are no more tokens to consume.
   */
  isEmpty() {
    return this.pos >= this.tokens.length;
  }

  /**
   * Checks if the next token matches the given type and value.
   *
   * @param {TokenType} t - The expected token type.
   * @param {string} val - The expected token value.
   * @returns {boolean} Whether the next token matches.
   */
  isNext(t, val) {
    const token = this.peek();
    return token && token.type === t && token.value === val;
  }
}

/**
 * Parses the tokens into an AST with the following operator precedence
 * (highest to lowest):
 * 1. `~`   (not)
 * 2. `&`   (and)
 * 3. `|`   (or)
 * 4. `->`  (implies)
 * 5. `<->` (if and only if)
 *
 * @param {Token[]} tokens - The token array to parse.
 * @returns {ASTNode} The root node of the parsed AST.
 * @throws {Error} If there are leftover tokens after parsing.
 */
function parseExpression(tokens) {
  let parser = new Parser(tokens);
  let expr = parseIfAndOnlyIf(parser);

  // If the parser is not at the end of then we have a token in which we
  // failed parsing.
  if (parser.pos < parser.tokens.length) {
    throw new Error('Unexpected token: ' + parser.tokens[parser.pos].value);
  }
  return expr;
}

/**
 * Parses a biconditional (`<->`) expression (lowest precedence).
 *
 * @param {Parser} parser - The parser instance.
 * @returns {ASTNode} The parsed AST node.
 */
function parseIfAndOnlyIf(parser) {
  let left = parseImplies(parser);

  while (parser.isNext('operator', '<->')) {
    parser.pop();
    let right = parseImplies(parser);
    left = { type: 'equiv', left: left, right: right };
  }
  return left;
}

/**
 * Parses an implication (`->`) expression.
 *
 * @param {Parser} parser - The parser instance.
 * @returns {ASTNode} The parsed AST node.
 */
function parseImplies(parser) {
  let left = parseOr(parser);
  while (parser.isNext('operator', '->')) {
    parser.pop();
    let right = parseOr(parser);
    left = { type: 'implies', left: left, right: right };
  }
  return left;
}

/**
 * Parses a disjunction (`|`) expression.
 *
 * @param {Parser} parser - The parser instance.
 * @returns {ASTNode} The parsed AST node.
 */
function parseOr(parser) {
  let left = parseAnd(parser);
  while (parser.isNext('operator', '|')) {
    parser.pop();
    let right = parseAnd(parser);
    left = { type: 'or', left: left, right: right };
  }
  return left;
}

/**
 * Parses a conjunction (`&`) expression.
 *
 * @param {Parser} parser - The parser instance.
 * @returns {ASTNode} The parsed AST node.
 */
function parseAnd(parser) {
  let left = parseNot(parser);
  while (parser.isNext('operator', '&')) {
    parser.pop();
    let right = parseNot(parser);
    left = { type: 'and', left: left, right: right };
  }
  return left;
}

/**
 * Parses a negation (`~`) expression (highest precedence among operators).
 *
 * @param {Parser} parser - The parser instance.
 * @returns {ASTNode} The parsed AST node.
 */
function parseNot(parser) {
  if (parser.isNext('operator', '~')) {
    parser.pop();
    let operand = parseNot(parser);
    return { type: 'not', operand: operand };
  }

  return parsePrimary(parser);
}

/**
 * Parses a primary expression: either a variable or a parenthesized sub-expression.
 *
 * @param {Parser} parser - The parser instance.
 * @returns {ASTNode} The parsed AST node.
 * @throws {Error} If the input ends unexpectedly or an unexpected token is found.
 */
function parsePrimary(parser) {
  const token = parser.pop();
  if (!token) {
    throw new Error('Unexpected end of input');
  }

  if (token.type === 'variable') {
    return { type: 'var', value: token.value };
  }
  if (token.type === 'paren' && token.value === '(') {
    let expr = parseIfAndOnlyIf(parser);
    if (parser.isNext('paren', ')')) {
      parser.pop();
    } else {
      throw new Error("Expected ')'");
    }

    return expr;
  }
  throw new Error('Unexpected token: ' + token.value);
}

/**
 * Recursively evaluates an AST node against a variable assignment.
 *
 * @param {ASTNode} ast - The AST node to evaluate.
 * @param {Record<string, boolean>} vars - A mapping of variable names to boolean values.
 * @returns {boolean} The result of evaluating the expression.
 * @throws {Error} If an unknown AST node type is encountered.
 */
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
      return !evaluateAST(ast.left, vars) || evaluateAST(ast.right, vars);
    case 'equiv':
      return evaluateAST(ast.left, vars) === evaluateAST(ast.right, vars);
    default:
      throw new Error('Unknown AST node type: ' + ast.type);
  }
}

/**
 * Extracts a sorted list of unique variable names from the AST.
 *
 * @param {ASTNode} ast - The root AST node.
 * @returns {string[]} A sorted array of variable names.
 */
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

/**
 * Replaces ASCII operator characters in the input with their Unicode symbol equivalents.
 *
 * @param {string} input - The raw expression string.
 * @returns {string} The formatted string with Unicode logical symbols.
 */
function formatInput(input) {
  return input
    .replace(/\s+/g, '')
    .replace(/\|/g, symbols.or)
    .replace(/\&/g, symbols.and)
    .replace(/\<\-\>/g, symbols.equiv)
    .replace(/(?<!<)\-\>/g, symbols.implies)
    .replace(/\~/g, symbols.not);
}

/**
 * Reads the expression from the input field, generates a truth table,
 * computes the DNF and CNF, and renders the results into the DOM.
 *
 * @returns {void}
 */
function generateTableAndNF() {
  const input = document.getElementById('expr').value;

  try {
    // Tokenize and parse the expression into an AST.
    const tokens = tokenize(input);
    const ast = parseExpression(tokens);

    // Get all variables used in the expression.
    const variables = getVariables(ast);

    // Build the table header row.
    let tableHTML = '<table><thead><tr>';
    variables.forEach((v) => {
      tableHTML += '<th>' + v + '</th>';
    });
    tableHTML += '<th>' + formatInput(input) + '</th>';
    tableHTML += '</tr></thead><tbody>';

    const numRows = Math.pow(2, variables.length);

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
        assignment[variables[j]] = Boolean(
          (i >> (variables.length - j - 1)) & 1,
        );
      }
      const result = evaluateAST(ast, assignment);

      // Build the table row.
      tableHTML += '<tr>';
      variables.forEach((v) => {
        tableHTML += '<td>' + (assignment[v] ? 'T' : 'F') + '</td>';
      });
      tableHTML += '<td>' + (result ? 'T' : 'F') + '</td>';
      tableHTML += '</tr>';

      // For DNF: For each row where the formula is true, build a conjunction clause.
      if (result) {
        let clause = variables
          .map((v) => (assignment[v] ? v : symbols.not + v))
          .join(symbols.and);

        if (variables.length > 1) {
          clause = '(' + clause + ')';
        }
        dnfClauses.push(clause);
      } else {
        // For CNF: For each row where the formula is false, build a disjunction clause.
        let clause = variables
          .map((v) => (assignment[v] ? symbols.not + v : v))
          .join(symbols.or);

        if (variables.length > 1) {
          clause = '(' + clause + ')';
        }
        cnfClauses.push(clause);
      }
    }
    tableHTML += '</tbody></table>';

    // Construct the overall DNF and CNF.
    let dnf = dnfClauses.length > 0 ? dnfClauses.join(symbols.or) : 'False';
    let cnf = cnfClauses.length > 0 ? cnfClauses.join(symbols.and) : 'True';

    // Combine the truth table and the normal forms for display.
    let resultHTML = tableHTML;
    resultHTML += `<div class="normal-forms">`;
    resultHTML += `<p><strong>DNF:</strong> ${dnf}</p>`;
    resultHTML += `<p><strong>CNF:</strong> ${cnf}</p>`;
    resultHTML += `</div>`;

    document.getElementById('result').innerHTML = resultHTML;
  } catch (e) {
    document.getElementById('result').innerHTML =
      `<p class="error">Error: ${e.message} </p>`;
  }
}

document
  .getElementById('generate')
  .addEventListener('click', generateTableAndNF);

/**
 * Keys handler for auto completing parenthesis and for automatically
 * submitting the statement when pressing the enter key.
 */
document.getElementById('expr').addEventListener('keydown', (event) => {
  const input = event.target;

  if (event.key === '(') {
    event.preventDefault();

    const start = input.selectionStart;
    const end = input.selectionEnd;

    input.value =
      input.value.slice(0, start) +
      '(' +
      input.value.slice(start, end) +
      ')' +
      input.value.slice(end);
    input.selectionStart = start + 1;
    input.selectionEnd = end + 1;
    return;
  }

  if (event.key === 'Enter') {
    generateTableAndNF();
    return;
  }
});
