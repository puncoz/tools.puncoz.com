/**
 * The one content column, shared by the header, every page body and the footer.
 *
 * Lives here rather than in a component so the header can use it without
 * importing the shell that renders the header — the constant has no dependencies
 * and therefore no cycle to create.
 *
 * Pages used to pick their own width: the gallery and admin were `max-w-6xl`,
 * the landing page `max-w-5xl`, settings, account and the legal documents
 * `max-w-3xl`. Every page then looked slightly misaligned against the last one,
 * because the header and the body were agreeing on nothing but the padding.
 */
const CONTAINER = "mx-auto w-full max-w-5xl px-6"

export { CONTAINER }
