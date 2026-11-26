// What a tool row says: each tool in words, while it runs and once it's done.
import { RESEARCH_TOOL } from "@bluechip/domain/tools/Toolkit"
import * as Predicate from "effect/Predicate"
import type { ToolRow } from "./thread.ts"

const LABELS: Readonly<Record<string, readonly [running: string, done: string]>> = {
  getPortfolio: ["Reading your portfolio", "Read your portfolio"],
  getPrices: ["Checking prices", "Checked prices"],
  getStock: ["Looking up the stock", "Looked up the stock"],
  getStockFacts: ["Looking up the stock's facts", "Looked up the stock's facts"],
  getQuote: ["Getting a quote", "Got a quote"],
  getActivity: ["Reading your activity", "Read your activity"],
  listAgents: ["Reading your agents", "Read your agents"],
  getAgent: ["Reading the agent", "Read the agent"],
  getAgentUsage: ["Checking what the agent has used", "Checked what the agent has used"],
  getAgentHistory: ["Reading the agent's history", "Read the agent's history"],
  getAgentJournal: ["Reading the agent's journal", "Read the agent's journal"],
  explainDecision: ["Looking into the decision", "Looked into the decision"],
  listPolicies: ["Reading the policies", "Read the policies"],
  listTemplates: ["Reading your templates", "Read your templates"],
  checkAgentSpec: ["Checking the rules", "Checked the rules"],
  proposeTrade: ["Preparing the trade", "Prepared the trade"],
  proposeRebalance: ["Preparing the rebalance", "Prepared the rebalance"],
  pauseAgent: ["Preparing to pause the agent", "Ready to pause the agent"],
  resumeAgent: ["Preparing to resume the agent", "Ready to resume the agent"],
  pauseAll: ["Preparing to pause every agent", "Ready to pause every agent"],
  saveTemplate: ["Preparing the template", "Prepared the template"],
  draftAgent: ["Drafting the agent", "Drafted the agent"],
  changeAgentPolicies: ["Preparing the change", "Prepared the change"],
  renewAgent: ["Preparing the renewal", "Prepared the renewal"],
  removeAgent: ["Preparing the removal", "Prepared the removal"],
  listAutomations: ["Reading your automations", "Read your automations"],
  createAutomation: ["Drafting the automation", "Drafted the automation"],
  pauseAutomation: ["Preparing to pause the automation", "Ready to pause the automation"],
  remember: ["Saving a memory", "Saved a memory"],
  forget: ["Forgetting a memory", "Forgot a memory"],
  listMemories: ["Reading your memories", "Read your memories"],
  searchMemory: ["Searching what it remembers", "Searched what it remembers"],
  searchHelp: ["Searching bluechip's help", "Searched bluechip's help"],
  getPerformance: ["Reading how you're doing", "Read how you're doing"],
  getStockPerformance: ["Reading the stock's results", "Read the stock's results"],
  getAgentPerformance: ["Reading the agent's results", "Read the agent's results"],
  getAutomationPerformance: ["Reading the automation's results", "Read the automation's results"],
  [RESEARCH_TOOL]: ["Searching the web", "Searched the web"]
}

const FALLBACK = ["Working on it", "Done"] as const

const RESUME_AUTOMATION = ["Preparing to resume the automation", "Ready to resume the automation"] as const

// One tool both pauses and resumes an automation; its arguments say which.
const labelsOf = (row: ToolRow): readonly [running: string, done: string] =>
  row.name === "pauseAutomation" && Predicate.hasProperty(row.params, "resume") && row.params.resume === true ?
    RESUME_AUTOMATION :
    LABELS[row.name] ?? FALLBACK

/** "Reading your portfolio…", "Read your portfolio", or "Didn't finish reading your portfolio". */
export const toolLabel = (row: ToolRow): string => {
  const [running, done] = labelsOf(row)
  if (row.state === "running") return `${running}…`
  if (row.state === "done") return done
  return `Didn't finish ${running.charAt(0).toLowerCase()}${running.slice(1)}`
}
