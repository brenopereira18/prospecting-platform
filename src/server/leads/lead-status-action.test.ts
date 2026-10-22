import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createChangeLeadStatusAction } from "./lead-status-action";
import { LeadStatusError } from "./lead-status.service";

const input = { leadId: randomUUID(), status: "GANHO", expectedRevision: 0 };
const data = { changed: true, status: "GANHO" as const, statusRevision: 1 };

test("unauthenticated actions do not access the service or invalidate routes", async () => {
  const action = createChangeLeadStatusAction({
    getUser: async () => null,
    service: {
      change: async () => {
        assert.fail("must authenticate first");
      },
    },
    invalidate: () => {
      assert.fail("must not invalidate");
    },
  });
  assert.deepEqual(await action(input), {
    success: false,
    code: "UNAUTHENTICATED",
    error: "Sua sessão expirou. Faça login novamente.",
  });
});

test("server validation rejects invalid statuses, dates and client userIds before mutation", async () => {
  const action = createChangeLeadStatusAction({
    getUser: async () => ({ id: "session-owner" }),
    service: {
      change: async () => {
        assert.fail("invalid input must not reach mutation");
      },
    },
    invalidate: () => {
      assert.fail("must not invalidate");
    },
  });
  for (const value of [
    { ...input, status: "INVALID" },
    { ...input, userId: "other" },
    { ...input, occurredAt: "2000-01-01" },
  ]) {
    const result = await action(value);
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.code, "INVALID_INPUT");
  }
});

test("the session identity is used and committed changes invalidate the lead views", async () => {
  const invalidated: string[] = [];
  const action = createChangeLeadStatusAction({
    getUser: async () => ({ id: "session-owner" }),
    service: {
      change: async (value, userId) => {
        assert.deepEqual(value, input);
        assert.equal(userId, "session-owner");
        return data;
      },
    },
    invalidate: (leadId) => {
      invalidated.push(leadId);
    },
  });
  assert.deepEqual(await action(input), { success: true, data });
  assert.deepEqual(invalidated, [input.leadId]);
});

test("unchanged status is a successful no-op and does not invalidate", async () => {
  const action = createChangeLeadStatusAction({
    getUser: async () => ({ id: "owner" }),
    service: {
      change: async () => ({ ...data, changed: false, statusRevision: 0 }),
    },
    invalidate: () => {
      assert.fail("no-op must not invalidate");
    },
  });
  assert.deepEqual(await action(input), {
    success: true,
    data: { ...data, changed: false, statusRevision: 0 },
  });
});

test("conflicts and authorization failures are actionable and do not report success", async () => {
  for (const code of ["CONFLICT", "NOT_FOUND"] as const) {
    const action = createChangeLeadStatusAction({
      getUser: async () => ({ id: "owner" }),
      service: {
        change: async () => {
          throw new LeadStatusError(code, "Safe message");
        },
      },
      invalidate: () => {
        assert.fail("failure must not invalidate");
      },
    });
    assert.deepEqual(await action(input), {
      success: false,
      code,
      error: "Safe message",
    });
  }
});

test("unexpected database failures do not leak provider details", async (context) => {
  context.mock.method(console, "error", () => {});
  const action = createChangeLeadStatusAction({
    getUser: async () => ({ id: "owner" }),
    service: {
      change: async () => {
        throw new Error("private database address");
      },
    },
    invalidate: () => {},
  });
  const result = await action(input);
  assert.equal(result.success, false);
  assert.doesNotMatch(JSON.stringify(result), /private database address/);
});
