/**
 * Minimal SQL Lexer for NL2SQL SELECT validation.
 *
 * Covers: SELECT with JOINs, subqueries, aggregations, WHERE, GROUP BY,
 *         HAVING, ORDER BY, LIMIT, UNION, CTEs, CASE expressions.
 * Also recognizes DDL/DML keywords for statement-type detection (reject non-SELECT).
 */
lexer grammar SqlLexer;

// ─── Keywords ──────────────────────────────────────────────────────────
// DQL
SELECT          : S E L E C T ;
FROM            : F R O M ;
WHERE           : W H E R E ;
AND             : A N D ;
OR              : O R ;
NOT             : N O T ;
IN              : I N ;
BETWEEN         : B E T W E E N ;
LIKE            : L I K E ;
IS              : I S ;
NULL_           : N U L L ;
TRUE_           : T R U E ;
FALSE_          : F A L S E ;
AS              : A S ;
ON              : O N ;
USING           : U S I N G ;
JOIN            : J O I N ;
INNER           : I N N E R ;
LEFT            : L E F T ;
RIGHT           : R I G H T ;
FULL            : F U L L ;
OUTER           : O U T E R ;
CROSS           : C R O S S ;
NATURAL         : N A T U R A L ;
GROUP           : G R O U P ;
BY              : B Y ;
HAVING          : H A V I N G ;
ORDER           : O R D E R ;
ASC             : A S C ;
DESC            : D E S C ;
LIMIT           : L I M I T ;
OFFSET          : O F F S E T ;
UNION           : U N I O N ;
ALL             : A L L ;
DISTINCT        : D I S T I N C T ;
EXISTS          : E X I S T S ;
CASE            : C A S E ;
WHEN            : W H E N ;
THEN            : T H E N ;
ELSE            : E L S E ;
END             : E N D ;
CAST            : C A S T ;
WITH            : W I T H ;
RECURSIVE       : R E C U R S I V E ;
EXCEPT          : E X C E P T ;
INTERSECT       : I N T E R S E C T ;
FETCH           : F E T C H ;
FIRST           : F I R S T ;
NEXT            : N E X T ;
ROWS            : R O W S ;
ROW             : R O W ;
ONLY            : O N L Y ;
OVER            : O V E R ;
PARTITION       : P A R T I T I O N ;
WINDOW          : W I N D O W ;
RANGE           : R A N G E ;
UNBOUNDED       : U N B O U N D E D ;
PRECEDING       : P R E C E D I N G ;
FOLLOWING       : F O L L O W I N G ;
CURRENT         : C U R R E N T ;
NULLS           : N U L L S ;
LAST            : L A S T ;
ESCAPE          : E S C A P E ;
ANY             : A N Y ;
SOME            : S O M E ;
LATERAL         : L A T E R A L ;
FILTER          : F I L T E R ;
WITHIN          : W I T H I N ;

// Aggregate functions (recognized as keywords for visitor convenience)
COUNT           : C O U N T ;
SUM             : S U M ;
AVG             : A V G ;
MIN             : M I N ;
MAX             : M A X ;

// Data types for CAST
INT             : I N T ;
INTEGER         : I N T E G E R ;
BIGINT          : B I G I N T ;
SMALLINT        : S M A L L I N T ;
FLOAT           : F L O A T ;
DOUBLE          : D O U B L E ;
DECIMAL         : D E C I M A L ;
NUMERIC         : N U M E R I C ;
CHAR            : C H A R ;
VARCHAR         : V A R C H A R ;
TEXT            : T E X T ;
DATE            : D A T E ;
TIME            : T I M E ;
TIMESTAMP       : T I M E S T A M P ;
BOOLEAN         : B O O L E A N ;
INTERVAL        : I N T E R V A L ;

// ─── DDL/DML keywords (for statement-type rejection) ───────────────────
INSERT          : I N S E R T ;
INTO            : I N T O ;
VALUES          : V A L U E S ;
UPDATE          : U P D A T E ;
SET             : S E T ;
DELETE          : D E L E T E ;
CREATE          : C R E A T E ;
ALTER           : A L T E R ;
DROP            : D R O P ;
TRUNCATE        : T R U N C A T E ;
TABLE           : T A B L E ;
INDEX           : I N D E X ;
VIEW            : V I E W ;
DATABASE        : D A T A B A S E ;
SCHEMA          : S C H E M A ;
GRANT           : G R A N T ;
REVOKE          : R E V O K E ;
EXEC            : E X E C ;
EXECUTE         : E X E C U T E ;
CALL            : C A L L ;
MERGE           : M E R G E ;
REPLACE         : R E P L A C E ;
LOAD            : L O A D ;
DATA            : D A T A ;
OUTFILE         : O U T F I L E ;

// ─── Operators & Symbols ───────────────────────────────────────────────
STAR            : '*' ;
DOT             : '.' ;
COMMA           : ',' ;
SEMI            : ';' ;
LPAREN          : '(' ;
RPAREN          : ')' ;
EQ              : '=' ;
NEQ             : '!=' | '<>' ;
LT              : '<' ;
GT              : '>' ;
LTE             : '<=' ;
GTE             : '>=' ;
PLUS            : '+' ;
MINUS           : '-' ;
SLASH           : '/' ;
PERCENT         : '%' ;
CONCAT          : '||' ;
SCOPE           : '::' ;

// ─── Literals ──────────────────────────────────────────────────────────
INTEGER_LITERAL : DIGIT+ ;
DECIMAL_LITERAL : DIGIT+ DOT DIGIT*
                | DOT DIGIT+
                ;
STRING_LITERAL  : '\'' ( ~'\'' | '\'\'' )* '\'' ;

// ─── Identifiers ───────────────────────────────────────────────────────
QUOTED_IDENTIFIER : '"' ( ~'"' | '""' )* '"' ;
BACKTICK_IDENTIFIER : '`' ( ~'`' | '``' )* '`' ;
IDENTIFIER      : [a-zA-Z_] [a-zA-Z_0-9$]* ;

// ─── Whitespace & Comments ─────────────────────────────────────────────
WS              : [ \t\r\n]+ -> skip ;
LINE_COMMENT    : '--' ~[\r\n]* -> skip ;
BLOCK_COMMENT   : '/*' .*? '*/' -> skip ;

// ─── Fragment rules for case-insensitive keywords ──────────────────────
fragment A : [aA] ;
fragment B : [bB] ;
fragment C : [cC] ;
fragment D : [dD] ;
fragment E : [eE] ;
fragment F : [fF] ;
fragment G : [gG] ;
fragment H : [hH] ;
fragment I : [iI] ;
fragment J : [jJ] ;
fragment K : [kK] ;
fragment L : [lL] ;
fragment M : [mM] ;
fragment N : [nN] ;
fragment O : [oO] ;
fragment P : [pP] ;
fragment Q : [qQ] ;
fragment R : [rR] ;
fragment S : [sS] ;
fragment T : [tT] ;
fragment U : [uU] ;
fragment V : [vV] ;
fragment W : [wW] ;
fragment X : [xX] ;
fragment Y : [yY] ;
fragment Z : [zZ] ;
fragment DIGIT : [0-9] ;
