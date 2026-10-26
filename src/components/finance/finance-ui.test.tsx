import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FinanceTotals } from "./finance-ui";

test("overview totals identify all-period sales and preserve all monetary amounts", () => {
  const html = renderToStaticMarkup(
    <FinanceTotals sold="1000.01" received="25.00" outstanding="975.01" />,
  );
  assert.match(html, /Total vendido/);
  assert.match(html, /Total recebido/);
  assert.match(html, /Saldo pendente/);
  for (const value of ["1.000,01", "25,00", "975,01"])
    assert.ok(html.includes(value));
});
test("sale totals identify the sale scope without implying aggregate sales or receipt", () => {
  const html = renderToStaticMarkup(
    <FinanceTotals
      scope="sale"
      sold="400.00"
      received="0.00"
      outstanding="400.00"
    />,
  );
  assert.match(html, /Valor da venda/);
  assert.doesNotMatch(html, /Total vendido/);
  assert.match(html, /Recebido/);
  assert.match(html, /0,00/);
  assert.match(html, /400,00/);
});
