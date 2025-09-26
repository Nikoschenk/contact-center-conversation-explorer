import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, "..", "data", "sample_input_ext.json");
const CONVERSATION_COUNT = 500;

const callers = [
  "Alex", "Jordan", "Taylor", "Morgan", "Riley", "Casey", "Harper", "Drew", "Bailey", "Peyton",
  "Sam", "Jamie", "Chris", "Reese", "Avery", "Skyler", "Cameron", "Rowan", "Emerson", "Hayden",
];

const departments = ["customer_service_team", "benefits_specialist_team", "tech_support_pod", "payroll_operations"];
const knowledgeTopics = [
  "health benefits eligibility",
  "vpn troubleshooting steps",
  "holiday calendar",
  "expense reimbursement policy",
  "onboarding checklist",
  "password reset instructions",
  "training portal access",
  "remote work guidelines",
  "hardware replacement process",
  "travel approval workflow",
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[randomInt(0, arr.length - 1)];

function baseIsoDate() {
  const start = new Date("2025-09-20T08:00:00Z").getTime();
  const dayOffset = randomInt(0, 14) * 24 * 60 * 60 * 1000;
  const minuteOffset = randomInt(0, 9 * 60) * 60 * 1000;
  return start + dayOffset + minuteOffset;
}

function makeTurn({
  idx,
  role,
  text,
  intent = "general",
  sentiment = "neutral",
  timestamp,
  agentic_action,
  ended_call = false,
}) {
  const turn = {
    role,
    turn_id: idx,
    text,
    timestamp: new Date(timestamp).toISOString(),
    intent,
    sentiment,
    ended_call,
  };
  if (agentic_action && agentic_action.length) {
    turn.agentic_action = agentic_action;
  }
  return turn;
}

function makeToolCall(name, payload) {
  return {
    type: "tool_call",
    tool_name: name,
    request: payload,
  };
}

function makeToolOutput(name, payload) {
  return {
    type: "tool_output",
    tool_name: name,
    response: payload,
  };
}

function makePersistentStorage(payload) {
  return {
    type: "persistent_storage",
    tool_name: "conversation_memory",
    response: payload,
  };
}

function makeAgentInvocation(description) {
  return {
    type: "agent_invocation",
    description,
  };
}

function generateAuthenticationBlock(state, employeeId, pinFragment) {
  const { turns, baseTimestamp } = state;
  const callerName = state.callerName;
  const startIdx = turns.length + 1;
  let ts = state.currentTs;
  const next = (delta = randomInt(6, 18)) => {
    ts += delta * 1000;
    return ts;
  };

  const block = [
    makeTurn({
      idx: startIdx,
      role: "caller",
      text: `Hi, this is ${callerName}. I need help verifying my account details.`,
      intent: "greeting",
      sentiment: "neutral",
      timestamp: ts,
    }),
    makeTurn({
      idx: startIdx + 1,
      role: "bot",
      text: "Thanks for calling. To get started, may I have your employee ID?",
      intent: "authentication",
      sentiment: "neutral",
      timestamp: next(),
    }),
    makeTurn({
      idx: startIdx + 2,
      role: "caller",
      text: `Sure, it's ${employeeId}.`,
      intent: "provide_employee_id",
      sentiment: "neutral",
      timestamp: next(),
    }),
    makeTurn({
      idx: startIdx + 3,
      role: "bot",
      text: "Thank you. For security, can you confirm the first two digits of your PIN?",
      intent: "authentication",
      sentiment: "neutral",
      timestamp: next(),
    }),
    makeTurn({
      idx: startIdx + 4,
      role: "caller",
      text: `They are ${pinFragment}.`,
      intent: "provide_pin_digits",
      sentiment: "neutral",
      timestamp: next(),
    }),
  ];

  const toolName = "verify_employee_identity";
  const toolActions = [
    makeToolCall(toolName, { employee_id: employeeId, pin_prefix: pinFragment }),
    makeToolOutput(toolName, { status: "verified", employee: employeeId }),
    makePersistentStorage({ key: "last_verified_user", value: employeeId }),
  ];

  block.push(
    makeTurn({
      idx: startIdx + 5,
      role: "bot",
      text: "Great, I've confirmed your identity. How can I assist you today?",
      intent: "authentication_success",
      sentiment: "positive",
      timestamp: next(),
      agentic_action: toolActions,
    })
  );

  state.currentTs = ts;
  state.turns.push(...block);
}

function addKnowledgeLookup(state, topic) {
  const turns = state.turns;
  let idx = turns.length + 1;
  let ts = state.currentTs;
  const next = (delta = randomInt(7, 16)) => {
    ts += delta * 1000;
    return ts;
  };

  const questionVariants = [
    `I need more information on ${topic}.`,
    `Can you look up ${topic}?`,
    `What does the knowledge base say about ${topic}?`,
  ];
  const responseVariants = [
    `Let me check ${topic}.`,
    `I'll search the knowledge base for ${topic}.`,
    `Give me a moment to review ${topic}.`,
  ];

  turns.push(
    makeTurn({
      idx: idx++,
      role: "caller",
      text: randomItem(questionVariants),
      intent: "knowledge_request",
      sentiment: "neutral",
      timestamp: ts,
    })
  );

  const toolName = "query_knowledgebase";
  const articleId = `kb_${randomInt(100, 999)}`;
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: randomItem(responseVariants),
      intent: "knowledge_lookup",
      sentiment: "neutral",
      timestamp: next(),
      agentic_action: [
        makeToolCall(toolName, { query: topic, locale: "en-US" }),
        makeToolOutput(toolName, {
          article_id: articleId,
          summary: `Summary for ${topic}`,
          confidence: Number((Math.random() * 0.3 + 0.6).toFixed(2)),
        }),
      ],
    })
  );

  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: `The knowledge base recommends the following: ${topic} guidance is now on your email.`,
      intent: "knowledge_response",
      sentiment: "positive",
      timestamp: next(),
    })
  );

  state.currentTs = ts;
}

function addCaseReroute(state) {
  const { turns } = state;
  let idx = turns.length + 1;
  let ts = state.currentTs;
  const next = (delta = randomInt(5, 15)) => {
    ts += delta * 1000;
    return ts;
  };
  const target = randomItem(departments);
  const ticketId = `case_${randomInt(10000, 99999)}`;
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: "This might require a specialist. I'll escalate it for you now.",
      intent: "escalation",
      sentiment: "neutral",
      timestamp: ts,
      agentic_action: [
        makeToolCall("forward_to_human", { routing_target: target, ticket_id: ticketId }),
        makeAgentInvocation(`Escalated to ${target}`),
        makePersistentStorage({ key: "last_ticket_id", value: ticketId }),
      ],
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "caller",
      text: "Okay, I'll wait for the specialist.",
      intent: "acknowledge_escalation",
      sentiment: "neutral",
      timestamp: next(),
    })
  );
  state.currentTs = ts;
}

function addStatusUpdate(state) {
  const { turns } = state;
  let idx = turns.length + 1;
  let ts = state.currentTs;
  const next = (delta = randomInt(6, 12)) => {
    ts += delta * 1000;
    return ts;
  };
  const orderId = `order_${randomInt(2000, 7000)}`;
  turns.push(
    makeTurn({
      idx: idx++,
      role: "caller",
      text: `Can you tell me the status of order ${orderId}?`,
      intent: "order_status_request",
      sentiment: "neutral",
      timestamp: ts,
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: "I'll look that up for you.",
      intent: "order_status_lookup",
      sentiment: "neutral",
      timestamp: next(),
      agentic_action: [
        makeToolCall("query_order_system", { order_id: orderId }),
        makeToolOutput("query_order_system", {
          order_id: orderId,
          status: randomItem(["processing", "shipped", "backordered", "delivered"]),
          eta_days: randomInt(1, 7),
        }),
      ],
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: `The order ${orderId} is currently being processed. I'll send you updates as it progresses.`,
      intent: "order_status_response",
      sentiment: "positive",
      timestamp: next(),
    })
  );
  state.currentTs = ts;
}

function addBenefitChange(state) {
  const { turns } = state;
  let idx = turns.length + 1;
  let ts = state.currentTs;
  const next = (delta = randomInt(6, 15)) => {
    ts += delta * 1000;
    return ts;
  };
  const benefit = randomItem(["health", "dental", "vision", "retirement"]);
  const plan = randomItem(["premium", "standard", "basic"]);

  turns.push(
    makeTurn({
      idx: idx++,
      role: "caller",
      text: `I need to update my ${benefit} plan enrollment.`,
      intent: "benefits_change_request",
      sentiment: "neutral",
      timestamp: ts,
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: "Absolutely, I'll process that now.",
      intent: "benefits_change_process",
      sentiment: "neutral",
      timestamp: next(),
      agentic_action: [
        makeToolCall("update_benefits_portal", { benefit_type: benefit, plan }),
        makeToolOutput("update_benefits_portal", { benefit_type: benefit, plan, status: "submitted" }),
        makePersistentStorage({ key: "last_benefit_change", value: `${benefit}_${plan}` }),
      ],
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: `Your ${benefit} plan has been updated to ${plan}.`,
      intent: "benefits_change_confirm",
      sentiment: "positive",
      timestamp: next(),
    })
  );
  state.currentTs = ts;
}

function addPayrollInquiry(state) {
  const { turns } = state;
  let idx = turns.length + 1;
  let ts = state.currentTs;
  const next = (delta = randomInt(5, 12)) => {
    ts += delta * 1000;
    return ts;
  };
  const month = randomItem([
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  ]);
  const payrollId = `pay_${randomInt(1000, 9999)}`;
  turns.push(
    makeTurn({
      idx: idx++,
      role: "caller",
      text: `I think my ${month} paycheck is missing overtime hours.`,
      intent: "payroll_issue",
      sentiment: "negative",
      timestamp: ts,
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: "Let me review the payroll record.",
      intent: "payroll_lookup",
      sentiment: "neutral",
      timestamp: next(),
      agentic_action: [
        makeToolCall("payroll_system_lookup", { payroll_id: payrollId, month }),
        makeToolOutput("payroll_system_lookup", {
          payroll_id: payrollId,
          overtime_hours: randomInt(0, 10),
          status: "reviewed",
        }),
      ],
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: "I see the overtime was not captured. I'll submit a correction request now.",
      intent: "payroll_resolution",
      sentiment: "neutral",
      timestamp: next(),
      agentic_action: [
        makeToolCall("submit_payroll_adjustment", { payroll_id: payrollId, adjustment: "add_overtime" }),
        makeToolOutput("submit_payroll_adjustment", {
          payroll_id: payrollId,
          status: "pending_manager_review",
          expected_completion_days: randomInt(1, 3),
        }),
      ],
    })
  );
  state.currentTs = ts;
}

function concludeCall(state) {
  const { turns } = state;
  let idx = turns.length + 1;
  let ts = state.currentTs;
  const next = (delta = randomInt(5, 10)) => {
    ts += delta * 1000;
    return ts;
  };
  turns.push(
    makeTurn({
      idx: idx++,
      role: "caller",
      text: "That covers everything, thank you!",
      intent: "gratitude",
      sentiment: "positive",
      timestamp: ts,
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "bot",
      text: "Happy to help. Have a great day!",
      intent: "farewell",
      sentiment: "positive",
      timestamp: next(),
      agentic_action: [makePersistentStorage({ key: "final_summary", value: "case_closed" })],
    })
  );
  turns.push(
    makeTurn({
      idx: idx++,
      role: "caller",
      text: "Goodbye.",
      intent: "farewell",
      sentiment: "positive",
      timestamp: next(),
      ended_call: true,
    })
  );
  state.currentTs = ts;
}

function ensureTurnCount(state, minTurns, maxTurns) {
  // Add small talk loops if needed to reach minimum length.
  const { turns } = state;
  let idx = turns.length + 1;
  let ts = state.currentTs;
  while (turns.length < minTurns) {
    const delta = randomInt(5, 10) * 1000;
    ts += delta;
    const topic = randomItem([
      "Just checking if anything else is needed.",
      "Do you need additional assistance?",
      "Thanks for your patience while I double check the records.",
    ]);
    const callerReply = randomItem([
      "No worries, I'm still here.",
      "Take your time, thank you.",
      "I appreciate the update.",
    ]);
    turns.push(
      makeTurn({
        idx: idx++,
        role: "bot",
        text: topic,
        intent: "status_update",
        sentiment: "neutral",
        timestamp: ts,
      })
    );
    ts += randomInt(5, 9) * 1000;
    turns.push(
      makeTurn({
        idx: idx++,
        role: "caller",
        text: callerReply,
        intent: "acknowledgement",
        sentiment: "neutral",
        timestamp: ts,
      })
    );
  }
  if (turns.length > maxTurns) {
    // Trim extra padding turns before conclusion if overshoot.
    state.turns = turns.slice(0, maxTurns);
    const last = state.turns[state.turns.length - 1];
    state.currentTs = last ? new Date(last.timestamp).getTime() : ts;
  } else {
    state.currentTs = ts;
  }
}

function generateConversation(idx) {
  const callerName = randomItem(callers);
  const employeeId = `EMP${randomInt(10000, 99999)}`;
  const pinFragment = `${randomInt(10, 99)}`;
  const minTurns = randomInt(10, 18);
  const maxTurns = randomInt(20, 30);
  const baseTime = baseIsoDate();

  const state = {
    turns: [],
    currentTs: baseTime,
    callerName,
  };

  generateAuthenticationBlock(state, employeeId, pinFragment);

  const chosenTopics = new Set();

  const loops = randomInt(2, 4);
  for (let i = 0; i < loops; i++) {
    const type = randomInt(0, 3);
    switch (type) {
      case 0: {
        const topic = randomItem(knowledgeTopics.filter((t) => !chosenTopics.has(t)) || knowledgeTopics);
        chosenTopics.add(topic);
        addKnowledgeLookup(state, topic);
        break;
      }
      case 1:
        addBenefitChange(state);
        break;
      case 2:
        addPayrollInquiry(state);
        break;
      default:
        addStatusUpdate(state);
        break;
    }

    if (Math.random() < 0.25) {
      addCaseReroute(state);
    }
  }

  ensureTurnCount(state, minTurns, maxTurns);
  concludeCall(state);

  let fullTurns = state.turns.slice();
  if (fullTurns.length > maxTurns) {
    const ending = fullTurns.slice(-3);
    const head = fullTurns.slice(0, Math.max(minTurns, maxTurns - ending.length));
    fullTurns = head.concat(ending);
  }

  if (fullTurns.length < minTurns) {
    let ts = new Date(fullTurns[fullTurns.length - 1].timestamp).getTime();
    let idx = fullTurns.length; // will increment before assignment
    while (fullTurns.length < minTurns) {
      ts += randomInt(6, 12) * 1000;
      idx += 1;
      fullTurns.splice(fullTurns.length - 1, 0,
        makeTurn({
          idx,
          role: "bot",
          text: "Just confirming if you need anything else today.",
          intent: "check_in",
          sentiment: "neutral",
          timestamp: ts,
        })
      );
      ts += randomInt(6, 10) * 1000;
      idx += 1;
      fullTurns.splice(fullTurns.length - 1, 0,
        makeTurn({
          idx,
          role: "caller",
          text: "No, that's all. Thanks.",
          intent: "acknowledgement",
          sentiment: "positive",
          timestamp: ts,
        })
      );
    }
  }

  if (fullTurns.length === 0 || !fullTurns[fullTurns.length - 1].ended_call) {
    const ts = fullTurns.length
      ? new Date(fullTurns[fullTurns.length - 1].timestamp).getTime() + randomInt(5, 10) * 1000
      : baseTime + randomInt(5, 10) * 1000;
    fullTurns.push(
      makeTurn({
        idx: fullTurns.length + 1,
        role: "caller",
        text: "Thanks again, bye!",
        intent: "farewell",
        sentiment: "positive",
        timestamp: ts,
        ended_call: true,
      })
    );
  }

  // fix turn ids sequential
  fullTurns.forEach((turn, i) => {
    turn.turn_id = i + 1;
  });

  const durationSeconds = Math.max(
    60,
    Math.round((new Date(fullTurns[fullTurns.length - 1].timestamp).getTime() - baseTime) / 1000)
  );

  return {
    conversation_id: `conv_ext_${String(idx + 1).padStart(3, "0")}`,
    duration_seconds: durationSeconds,
    turns: fullTurns,
  };
}

function main() {
  const conversations = [];
  for (let i = 0; i < CONVERSATION_COUNT; i++) {
    conversations.push(generateConversation(i));
  }

  const output = JSON.stringify({ conversations }, null, 2);
  fs.writeFileSync(OUTPUT_PATH, output);
  console.log(`Wrote ${CONVERSATION_COUNT} conversations to ${OUTPUT_PATH}`);
}

main();
