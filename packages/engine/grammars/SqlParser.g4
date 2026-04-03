/**
 * Minimal SQL Parser for NL2SQL SELECT validation.
 *
 * Goals:
 *   1. Parse SELECT statements comprehensively (JOINs, subqueries, CTEs, aggregations,
 *      window functions, CASE, UNION/INTERSECT/EXCEPT, etc.)
 *   2. Detect and reject DDL/DML statements at the grammar level.
 *   3. Expose table and column references via labeled rules for visitor extraction.
 */
parser grammar SqlParser;

options { tokenVocab = SqlLexer; }

// ─── Entry ─────────────────────────────────────────────────────────────

/** Top-level: one or more statements separated by semicolons. */
root
    : statement (SEMI statement)* SEMI? EOF
    ;

statement
    : selectStatement            # selectStmt
    | dmlStatement               # dmlStmt
    | ddlStatement               # ddlStmt
    | otherStatement             # otherStmt
    ;

// ─── DDL / DML (recognized only to reject) ─────────────────────────────

dmlStatement
    : INSERT INTO tableName (LPAREN columnNameList RPAREN)? (VALUES | selectStatement) .*?
    | UPDATE tableName SET .*?
    | DELETE FROM tableName .*?
    | MERGE .*?
    | REPLACE .*?
    | LOAD DATA .*?
    ;

ddlStatement
    : CREATE (TABLE | VIEW | INDEX | DATABASE | SCHEMA) .*?
    | ALTER  (TABLE | VIEW | DATABASE | SCHEMA) .*?
    | DROP   (TABLE | VIEW | INDEX | DATABASE | SCHEMA) .*?
    | TRUNCATE TABLE? tableName
    ;

otherStatement
    : GRANT .*?
    | REVOKE .*?
    | (EXEC | EXECUTE | CALL) .*?
    ;

// ─── SELECT ────────────────────────────────────────────────────────────

selectStatement
    : withClause? queryExpression orderByClause? limitClause?
    ;

withClause
    : WITH RECURSIVE? cteDefinition (COMMA cteDefinition)*
    ;

cteDefinition
    : identifier AS LPAREN selectStatement RPAREN
    ;

queryExpression
    : queryTerm ((UNION ALL? | EXCEPT | INTERSECT) queryTerm)*
    ;

queryTerm
    : queryPrimary
    ;

queryPrimary
    : selectClause
      fromClause?
      whereClause?
      groupByClause?
      havingClause?
    | LPAREN selectStatement RPAREN
    ;

selectClause
    : SELECT setQuantifier? selectElements
    ;

setQuantifier
    : DISTINCT
    | ALL
    ;

selectElements
    : selectElement (COMMA selectElement)*
    ;

selectElement
    : expression (AS? alias)?               # exprElement
    | tableName DOT STAR                    # tableWildcard
    | STAR                                  # allColumns
    ;

alias
    : identifier
    | STRING_LITERAL
    ;

// ─── FROM ──────────────────────────────────────────────────────────────

fromClause
    : FROM tableReference (COMMA tableReference)*
    ;

tableReference
    : tablePrimary joinPart*
    ;

tablePrimary
    : tableName (AS? alias)?                                  # tableRef
    | LPAREN selectStatement RPAREN (AS? alias)?              # subqueryRef
    | LATERAL LPAREN selectStatement RPAREN (AS? alias)?      # lateralRef
    ;

joinPart
    : joinType? JOIN tablePrimary joinCondition?
    ;

joinType
    : INNER
    | LEFT OUTER?
    | RIGHT OUTER?
    | FULL OUTER?
    | CROSS
    | NATURAL (LEFT | RIGHT | FULL)? OUTER?
    ;

joinCondition
    : ON expression
    | USING LPAREN columnNameList RPAREN
    ;

// ─── WHERE / GROUP BY / HAVING ─────────────────────────────────────────

whereClause
    : WHERE expression
    ;

groupByClause
    : GROUP BY expressionList
    ;

havingClause
    : HAVING expression
    ;

// ─── ORDER BY / LIMIT ─────────────────────────────────────────────────

orderByClause
    : ORDER BY orderByElement (COMMA orderByElement)*
    ;

orderByElement
    : expression (ASC | DESC)? (NULLS (FIRST | LAST))?
    ;

limitClause
    : LIMIT expression (COMMA expression)?
    | LIMIT expression OFFSET expression
    | OFFSET expression (ROW | ROWS)? (FETCH (FIRST | NEXT) expression (ROW | ROWS) ONLY)?
    ;

// ─── Expressions ───────────────────────────────────────────────────────

expressionList
    : expression (COMMA expression)*
    ;

expression
    : orExpression
    ;

orExpression
    : andExpression (OR andExpression)*
    ;

andExpression
    : notExpression (AND notExpression)*
    ;

notExpression
    : NOT notExpression
    | comparisonExpression
    ;

comparisonExpression
    : addExpression compareOp addExpression                                # compExpr
    | addExpression IS NOT? NULL_                                          # isNullExpr
    | addExpression NOT? IN LPAREN (selectStatement | expressionList) RPAREN # inExpr
    | addExpression NOT? BETWEEN addExpression AND addExpression            # betweenExpr
    | addExpression NOT? LIKE addExpression (ESCAPE addExpression)?         # likeExpr
    | EXISTS LPAREN selectStatement RPAREN                                 # existsExpr
    | addExpression compareOp (ANY | SOME | ALL) LPAREN selectStatement RPAREN # quantifiedExpr
    | addExpression                                                        # passThrough
    ;

compareOp
    : EQ | NEQ | LT | GT | LTE | GTE
    ;

addExpression
    : mulExpression ((PLUS | MINUS | CONCAT) mulExpression)*
    ;

mulExpression
    : unaryExpression ((STAR | SLASH | PERCENT) unaryExpression)*
    ;

unaryExpression
    : (PLUS | MINUS) unaryExpression
    | primaryExpression
    ;

primaryExpression
    : literal                                                         # literalExpr
    | columnRef                                                       # columnRefExpr
    | functionCall                                                    # funcExpr
    | LPAREN selectStatement RPAREN                                   # scalarSubquery
    | LPAREN expression RPAREN                                        # parenExpr
    | LPAREN expressionList RPAREN                                    # tupleExpr
    | caseExpression                                                  # caseExpr
    | castExpression                                                  # castExprAlt
    | primaryExpression SCOPE dataType                                # pgCastExpr
    ;

// ─── Column / Table references ─────────────────────────────────────────

columnRef
    : (schemaName=identifier DOT)? (table=identifier DOT)? column=identifier
    ;

tableName
    : (schemaName=identifier DOT)? table=identifier
    ;

columnNameList
    : columnRef (COMMA columnRef)*
    ;

// ─── Functions ─────────────────────────────────────────────────────────

functionCall
    : aggregateFunction
    | windowFunction
    | regularFunction
    ;

aggregateFunction
    : aggregateName LPAREN setQuantifier? (expression | STAR) RPAREN filterClause?
    ;

aggregateName
    : COUNT | SUM | AVG | MIN | MAX | identifier
    ;

filterClause
    : FILTER LPAREN WHERE expression RPAREN
    ;

windowFunction
    : (aggregateFunction | regularFunction) OVER windowSpec
    ;

windowSpec
    : LPAREN partitionClause? orderByClause? frameClause? RPAREN
    | identifier
    ;

partitionClause
    : PARTITION BY expressionList
    ;

frameClause
    : (ROWS | RANGE) frameBound
    | (ROWS | RANGE) BETWEEN frameBound AND frameBound
    ;

frameBound
    : UNBOUNDED PRECEDING
    | UNBOUNDED FOLLOWING
    | CURRENT ROW
    | expression PRECEDING
    | expression FOLLOWING
    ;

regularFunction
    : functionName LPAREN (setQuantifier? expressionList)? RPAREN
    ;

functionName
    : identifier
    | CAST
    | LEFT
    | RIGHT
    | REPLACE
    | DATE
    | TIME
    | TIMESTAMP
    ;

// ─── CASE / CAST ──────────────────────────────────────────────────────

caseExpression
    : CASE expression? (WHEN expression THEN expression)+ (ELSE expression)? END
    ;

castExpression
    : CAST LPAREN expression AS dataType RPAREN
    ;

dataType
    : typeName (LPAREN INTEGER_LITERAL (COMMA INTEGER_LITERAL)? RPAREN)?
    ;

typeName
    : INT | INTEGER | BIGINT | SMALLINT | FLOAT | DOUBLE | DECIMAL | NUMERIC
    | CHAR | VARCHAR | TEXT | DATE | TIME | TIMESTAMP | BOOLEAN | INTERVAL
    | identifier
    ;

// ─── Literals ──────────────────────────────────────────────────────────

literal
    : INTEGER_LITERAL
    | DECIMAL_LITERAL
    | STRING_LITERAL
    | TRUE_
    | FALSE_
    | NULL_
    ;

identifier
    : IDENTIFIER
    | QUOTED_IDENTIFIER
    | BACKTICK_IDENTIFIER
    // Allow non-reserved keywords as identifiers
    | nonReservedKeyword
    ;

nonReservedKeyword
    : COUNT | SUM | AVG | MIN | MAX
    | ASC | DESC | FIRST | LAST | NULLS
    | FILTER | WITHIN | PARTITION | OVER | WINDOW
    | RANGE | UNBOUNDED | PRECEDING | FOLLOWING | CURRENT
    | ROW | ROWS | ONLY | NEXT | FETCH
    | DATA | OUTFILE | TABLE | INDEX | VIEW | DATABASE | SCHEMA
    | RECURSIVE | LATERAL
    | REPLACE | DATE | TIME | TIMESTAMP | INTERVAL | BOOLEAN
    | INT | INTEGER | BIGINT | SMALLINT | FLOAT | DOUBLE | DECIMAL | NUMERIC
    | CHAR | VARCHAR | TEXT
    | ESCAPE | ANY | SOME | VALUES | SET
    ;
