// A streamed route can commit its URL and loading shell before its content.
// The page heading is absent from PageLoading and appears with the real page.
export async function waitForPageContent(page) {
  await page.locator("main h1").waitFor({ state: "visible", timeout: 12_000 });
}
