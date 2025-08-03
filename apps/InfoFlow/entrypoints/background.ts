import { browser, defineBackground } from "#imports";

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });
});
