# Device responsiveness review — 24 October 2026

The client supplied a photograph of Capture on an iPad. The desktop sidebar still occupied a column on a portrait tablet, squeezing the form. The customer app must adapt across phones, tablets in both orientations, laptops and desktops without changing approved wording, feature flags or privacy rules.

Use the collapsible Menu through 1024 CSS pixels, including when a desktop sidebar collapse preference was saved. Above 1024px keep the existing desktop sidebar and collapse control. Preserve the mobile menu's close and navigation behavior. Give tablet content the full available width. Native Safari date controls must fit their fields; touch inputs use at least 16px text to avoid focus zoom.

Expand existing feature checks across 320, 360, 390, 430, 640, 768, 820, 834, 1024, 1180, 1280, 1366, 1440 and 1920px widths. Check populated tasks/records, forms, panels, chat, Capture review, public pages and authentication using the existing feature fixtures. Add WebKit touch checks for Capture initial/details/manual draft and Settings, including iPad portrait/landscape, phone landscape, field boundaries and preserved text. Screenshots use mocked accounts. Browser engine/device-size simulation does not substitute for a physical-device smoke check.
