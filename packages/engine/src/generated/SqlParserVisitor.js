// Generated from grammars/SqlParser.g4 by ANTLR 4.13.2
// jshint ignore: start
import antlr4 from 'antlr4';

// This class defines a complete generic visitor for a parse tree produced by SqlParser.

export default class SqlParserVisitor extends antlr4.tree.ParseTreeVisitor {

	// Visit a parse tree produced by SqlParser#root.
	visitRoot(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#selectStmt.
	visitSelectStmt(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#dmlStmt.
	visitDmlStmt(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#ddlStmt.
	visitDdlStmt(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#otherStmt.
	visitOtherStmt(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#dmlStatement.
	visitDmlStatement(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#ddlStatement.
	visitDdlStatement(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#otherStatement.
	visitOtherStatement(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#selectStatement.
	visitSelectStatement(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#withClause.
	visitWithClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#cteDefinition.
	visitCteDefinition(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#queryExpression.
	visitQueryExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#queryTerm.
	visitQueryTerm(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#queryPrimary.
	visitQueryPrimary(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#selectClause.
	visitSelectClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#setQuantifier.
	visitSetQuantifier(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#selectElements.
	visitSelectElements(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#exprElement.
	visitExprElement(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#tableWildcard.
	visitTableWildcard(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#allColumns.
	visitAllColumns(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#alias.
	visitAlias(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#fromClause.
	visitFromClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#tableReference.
	visitTableReference(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#tableRef.
	visitTableRef(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#subqueryRef.
	visitSubqueryRef(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#lateralRef.
	visitLateralRef(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#joinPart.
	visitJoinPart(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#joinType.
	visitJoinType(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#joinCondition.
	visitJoinCondition(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#whereClause.
	visitWhereClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#groupByClause.
	visitGroupByClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#havingClause.
	visitHavingClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#orderByClause.
	visitOrderByClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#orderByElement.
	visitOrderByElement(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#limitClause.
	visitLimitClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#expressionList.
	visitExpressionList(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#expression.
	visitExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#orExpression.
	visitOrExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#andExpression.
	visitAndExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#notExpression.
	visitNotExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#compExpr.
	visitCompExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#isNullExpr.
	visitIsNullExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#inExpr.
	visitInExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#betweenExpr.
	visitBetweenExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#likeExpr.
	visitLikeExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#existsExpr.
	visitExistsExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#quantifiedExpr.
	visitQuantifiedExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#passThrough.
	visitPassThrough(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#compareOp.
	visitCompareOp(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#addExpression.
	visitAddExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#mulExpression.
	visitMulExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#unaryExpression.
	visitUnaryExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#funcExpr.
	visitFuncExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#literalExpr.
	visitLiteralExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#castExprAlt.
	visitCastExprAlt(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#columnRefExpr.
	visitColumnRefExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#caseExpr.
	visitCaseExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#tupleExpr.
	visitTupleExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#pgCastExpr.
	visitPgCastExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#scalarSubquery.
	visitScalarSubquery(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#parenExpr.
	visitParenExpr(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#columnRef.
	visitColumnRef(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#tableName.
	visitTableName(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#columnNameList.
	visitColumnNameList(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#functionCall.
	visitFunctionCall(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#aggregateFunction.
	visitAggregateFunction(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#aggregateName.
	visitAggregateName(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#filterClause.
	visitFilterClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#windowFunction.
	visitWindowFunction(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#windowSpec.
	visitWindowSpec(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#partitionClause.
	visitPartitionClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#frameClause.
	visitFrameClause(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#frameBound.
	visitFrameBound(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#regularFunction.
	visitRegularFunction(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#functionName.
	visitFunctionName(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#caseExpression.
	visitCaseExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#castExpression.
	visitCastExpression(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#dataType.
	visitDataType(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#typeName.
	visitTypeName(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#literal.
	visitLiteral(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#identifier.
	visitIdentifier(ctx) {
	  return this.visitChildren(ctx);
	}


	// Visit a parse tree produced by SqlParser#nonReservedKeyword.
	visitNonReservedKeyword(ctx) {
	  return this.visitChildren(ctx);
	}



}