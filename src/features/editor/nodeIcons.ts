// Icons a topic can carry before its text: a short, curated set that reads well at small sizes
// and covers what students mark most (priority, doubt, done, idea, date, subject).
export const NODE_ICONS = [
  "⭐",
  "❗",
  "❓",
  "✅",
  "❌",
  "💡",
  "📌",
  "📚",
  "📝",
  "📅",
  "⏰",
  "🎯",
  "🧠",
  "🧪",
  "🔢",
  "🌍",
  "⚠️",
  "🔥",
  "👍",
  "👎",
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "🚀",
] as const;

export const isNodeIcon = (value: unknown): value is string =>
  typeof value === "string" && (NODE_ICONS as readonly string[]).includes(value);
