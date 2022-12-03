export module MS {
  export interface Position {
    line: number;
    column: number;
  }
  export interface PositionRange {
    start: Position;
    end: Position;
  }

  export type Token =
    | AND
    | OR
    | PIPE
    | L
    | LL
    | R
    | RR
    | LPAREN
    | RPAREN
    | WORD
    | WORD_Q
    | WORD_DQ
    | EOF;
  export type TokenType = Token["type"];
  export interface TokenBase extends PositionRange {}
  export interface AND extends TokenBase {
    type: "AND";
  }
  export interface OR extends TokenBase {
    type: "OR";
  }
  export interface PIPE extends TokenBase {
    type: "PIPE";
  }
  export interface L extends TokenBase {
    type: "L";
  }
  export interface LL extends TokenBase {
    type: "LL";
  }
  export interface R extends TokenBase {
    type: "R";
  }
  export interface RR extends TokenBase {
    type: "RR";
  }
  export interface LPAREN extends TokenBase {
    type: "LPAREN";
  }
  export interface RPAREN extends TokenBase {
    type: "RPAREN";
  }
  export interface WORD extends TokenBase {
    type: "WORD";
    body: string;
  }
  export interface WORD_Q extends TokenBase {
    type: "WORD_Q";
    body: string;
  }
  export interface WORD_DQ extends TokenBase {
    type: "WORD_DQ";
    body: string;
  }
  export interface EOF extends TokenBase {
    type: "EOF";
  }

  export interface NodeBase extends PositionRange {}
  export type Node = Program;
  export interface Program extends NodeBase {
    body: AndOrList;
  }
  export interface AndOrList extends NodeBase {
    child: AndOrListNode[];
  }
  export type AndOr = "AND" | "OR";
  export type AndOrListNode = AndOrListNodeCompound | AndOrListNodePipeList;
  export interface AndOrListNodePipeList extends NodeBase {
    type: AndOr;
    command: PipeList;
  }
  export interface AndOrListNodeCompound extends NodeBase {
    type: AndOr;
    command: Compound;
  }
  export interface Compound extends NodeBase {
    type: "COMPOUND";
    body: AndOrList;
    redirections: Redirections;
  }
  export interface Redirections {
    stdin: Stdin[];
    stdout: Stdout[];
  }
  export interface StdinRedirection {
    type: "REDIRECTION";
    body: string;
  }
  export interface StdinHeredoc {
    type: "HEREDOC";
    body: string;
  }
  export type Stdin = StdinRedirection | StdinHeredoc;
  export interface StdoutRedirection {
    type: "REDIRECTION";
    body: string;
  }
  export interface StdoutRedirectionAppend {
    type: "REDIRECTION_APPEND";
    body: string;
  }
  export type Stdout = StdoutRedirection | StdoutRedirectionAppend;
  export interface PipeList extends NodeBase {
    child: Simple[];
  }
  export interface Simple extends NodeBase {
    args: string[];
    redirections: Redirections;
  }
}

type TokenizerContext =
  | ["INITIAL"]
  | ["ERROR", TokenizeError]
  | ["SPACE", MS.Token[]]
  | ["PREV_L", MS.Token[], MS.Position]
  | ["PREV_R", MS.Token[], MS.Position]
  | ["PREV_AND", MS.Token[], MS.Position]
  | ["PREV_OR", MS.Token[], MS.Position]
  | ["DEFAULT", MS.Token[]]
  | ["WORD", MS.Token[], string, MS.Position, MS.Position]
  | ["WORD_Q", MS.Token[], string, MS.Position]
  | ["WORD_DQ", MS.Token[], string, MS.Position];

export interface TokenizeError {
  message: string;
  line: number;
  column: number;
}

function UnrecognizedToken(line: number, column: number): TokenizeError {
  return { message: "Unrecognized token", line, column };
}

function UnterminatedString(line: number, column: number): TokenizeError {
  return { message: "Unterminated string", line, column };
}

type ExcludeFirst<T extends any[]> = T extends [any, ...infer I] ? I : never;

const tokenizerMap = {
  INITIAL: tokenizeInitial,
  SPACE: tokenizeSpace,
  PREV_L: tokenizePrevL,
  PREV_R: tokenizePrevR,
  PREV_AND: tokenizePrevAnd,
  PREV_OR: tokenizePrevOr,
  DEFAULT: tokenizeDefault,
  WORD: tokenizeWord,
  WORD_Q: tokenizeWordQ,
  WORD_DQ: tokenizeWordDQ,
} as {
  [K in Exclude<TokenizerContext[0], "ERROR">]: (
    char: string,
    line: number,
    column: number,
    ...rest: ExcludeFirst<TokenizerContext & [K]>
  ) => TokenizerContext;
};

function excludeFirst<T extends any[]>(
  _unused: any,
  ...rest: ExcludeFirst<T>
): ExcludeFirst<T> {
  return rest;
}

export function tokenize(input: string): MS.Token[] | TokenizeError {
  const chars = input
    .split("\n")
    .flatMap((l, line) =>
      l.split("").map((char, column) => ({ char, line: line + 1, column }))
    );
  let context: Exclude<TokenizerContext, ["ERROR", TokenizeError]> = [
    "INITIAL",
  ];
  for (let { char, line, column } of chars) {
    // console.log(context);
    // console.log({ char, line, column });
    const nextContext: TokenizerContext = tokenizerMap[context[0]](
      char,
      line,
      column,
      ...(excludeFirst(...(context as [any])) as [])
    );
    if (nextContext[0] === "ERROR") return nextContext[1];
    context = nextContext;
  }
  // console.log(context);
  // console.log({ char: "", line: -1, column: -1 });
  const nextContext: TokenizerContext = tokenizerMap[context[0]](
    "",
    -1,
    -1,
    ...(excludeFirst(...(context as [any])) as [])
  );
  // console.log(nextContext);
  if (nextContext[0] === "ERROR") return nextContext[1];
  context = nextContext;
  if (context[0] !== "DEFAULT") throw new Error("must never called");
  return context[1];
}

function tokenizeInitial(
  char: string,
  line: number,
  column: number
): TokenizerContext {
  return tokenizeDefault(char, line, column, []);
}

function tokenizeSpace(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[]
): TokenizerContext {
  if (char !== "" && " \t\n\v\f\r".includes(char)) {
    return ["SPACE", acc];
  } else {
    return tokenizeDefault(char, line, column, acc);
  }
}

function tokenizePrevL(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[],
  start: MS.Position
): TokenizerContext {
  if (char === "<") {
    acc.push({ type: "LL", start, end: { line, column } });
    return ["DEFAULT", acc];
  } else {
    acc.push({ type: "L", start, end: start });
    return tokenizeDefault(char, line, column, acc);
  }
}

function tokenizePrevR(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[],
  start: MS.Position
): TokenizerContext {
  if (char === ">") {
    acc.push({ type: "RR", start, end: { line, column } });
    return ["DEFAULT", acc];
  } else {
    acc.push({ type: "R", start, end: start });
    return tokenizeDefault(char, line, column, acc);
  }
}

function tokenizePrevAnd(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[],
  start: MS.Position
): TokenizerContext {
  if (char === "&") {
    acc.push({ type: "AND", start, end: { line, column } });
    return ["DEFAULT", acc];
  } else {
    return ["ERROR", UnrecognizedToken(line, column)];
  }
}

function tokenizePrevOr(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[],
  start: MS.Position
): TokenizerContext {
  if (char === "|") {
    acc.push({ type: "OR", start, end: { line, column } });
    return ["DEFAULT", acc];
  } else {
    acc.push({ type: "PIPE", start, end: start });
    return tokenizeDefault(char, line, column, acc);
  }
}

function tokenizeWord(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[],
  acc2: string,
  start: MS.Position,
  end: MS.Position
): TokenizerContext {
  if (" \t\n\v\f\r<>()&|".includes(char)) {
    acc.push({ type: "WORD", body: acc2, start, end });
    return tokenizeDefault(char, line, column, acc);
  } else {
    return ["WORD", acc, acc2 + char, start, { line, column }];
  }
}

function tokenizeWordQ(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[],
  acc2: string,
  start: MS.Position
): TokenizerContext {
  if (char === "") {
    return ["ERROR", UnterminatedString(line, column)];
  } else if (char === "'") {
    acc.push({ type: "WORD_Q", start, end: { line, column }, body: acc2 });
    return ["DEFAULT", acc];
  } else {
    return ["WORD_Q", acc, acc2 + char, start];
  }
}

function tokenizeWordDQ(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[],
  acc2: string,
  start: MS.Position
): TokenizerContext {
  if (char === "") {
    return ["ERROR", UnterminatedString(line, column)];
  } else if (char === '"') {
    acc.push({ type: "WORD_DQ", start, end: { line, column }, body: acc2 });
    return ["DEFAULT", acc];
  } else {
    return ["WORD_Q", acc, acc2 + char, start];
  }
}

function tokenizeDefault(
  char: string,
  line: number,
  column: number,
  acc: MS.Token[]
): TokenizerContext {
  if (char !== "" && " \t\n\v\f\r".includes(char)) {
    return ["SPACE", acc];
  } else if (char === "<") {
    return ["PREV_L", acc, { line, column }];
  } else if (char === ">") {
    return ["PREV_R", acc, { line, column }];
  } else if (char === "&") {
    return ["PREV_AND", acc, { line, column }];
  } else if (char === "|") {
    return ["PREV_OR", acc, { line, column }];
  } else if (char === "(") {
    acc.push({
      type: "LPAREN",
      start: { line, column },
      end: { line, column },
    });
    return ["DEFAULT", acc];
  } else if (char === ")") {
    acc.push({
      type: "RPAREN",
      start: { line, column },
      end: { line, column },
    });
    return ["DEFAULT", acc];
  } else if (char === "") {
    acc.push({ type: "EOF", start: { line, column }, end: { line, column } });
    return ["DEFAULT", acc];
  } else if (char === '"') {
    return ["WORD_DQ", acc, "", { line, column }];
  } else if (char === "'") {
    return ["WORD_Q", acc, "", { line, column }];
  } else {
    return ["WORD", acc, char, { line, column }, { line, column }];
  }
}

console.log(tokenize("ls -al | grep \\\\.c"));
