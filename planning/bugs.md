# Bug List
1. [x] Dim down the white border around input boxes. 
2. [x] System Prompt box should be text area that is expandable; move it under "LLM". 
3. [x] Add web search options ("auto", "off", "on") to the UI. (can we have horizontal 3-step toggle button???)
4. [x] Current "copy" icon is not working properly. Should only be avaible for corresponding message body. 
5. [x] Remove "Hide" from menu bar access
6. [x] Integrate backend with LLM settings on the UI. UI will alwayws load from .env, but once edited on the UI, .env will be overwritten. Does this work once bundled up as standalone app? 
7. [x] App window can ba dragged and moved around like normal app. 
8. [x] Move the build info to the bottom of "General" setting page. 
9. [x] Redesign API key in settings, over API call. 
10. [x] Query rewrite is not using LLM_FASTL_MODEL, or it's not picking up the right setting. 
11. [x] Hardcoded build info
12. [x] white icon on menu bar
13. [x] "Backend not connected". Add logging. 
14. [x] Clicking on tray icon show the drop down menu only. Clicking on "Show" to bring the window to the front. 
15. [ ] Support "shift+enter" to new line.
16. [ ] Chat window clears up when model selection and settings are changes. """Move the ChatWindow outside the conditional and use CSS to show/hide instead of mounting/unmounting:""
17. [x] Improve system prompts for query rewrite and assistant.time range; language; no mention search result; natural; notice user interaction; follow-up queries. 
18. [ ] Increase max search results if model selected is not from lm_studio
19. [ ] Clear chat confirmation message, add "do not show again" checkbox.
20. [ ] After having saved new model, the drop-down options should be relaoded. 
21. [x] Migrate .env properties file to .toml format. 
