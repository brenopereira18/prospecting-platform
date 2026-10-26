CREATE TABLE "monthly_sales_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "monthly_sales_goals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "monthly_sales_goals_positive_amount" CHECK ("amount" > 0),
    CONSTRAINT "monthly_sales_goals_month_start" CHECK (EXTRACT(DAY FROM "month") = 1)
);

CREATE UNIQUE INDEX "monthly_sales_goals_userId_month_key" ON "monthly_sales_goals"("userId", "month");
ALTER TABLE "monthly_sales_goals" ADD CONSTRAINT "monthly_sales_goals_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
