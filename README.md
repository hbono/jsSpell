jsSpell - a spellchecker written in JavaScript

1. Background

This spellchecker is a subset of the spellchecker of Chromium so JavaScript applications can check words with spellchecker dictionaries used by Chromium. Chromium uses a custom version of hunspell to use custom spellchecker dictionaries, which is called as BDICTs. This library reads BDICT dictionaries used by Chromium and check words with them. (This is just a prototype and it does not implement all features of hunspell, though.)

2. Usage

This library is implemented in pure JavaScript and works with all major browsers (Firefox, Google Chrome, IE10+, Safari, etc.) This library also includes a sample web application 'jsspell.html' and 'jsspell-test.js' so we can check words with BDICT dictionaries. To use this sample application, follow the steps listed below.

(0) Download BDICT files from the Chromium project <http://src.chromium.org/viewvc/chrome/trunk/deps/third_party/hunspell_dictionaries/>.
(1) Download all JavaScript files and HTML files in this project.
(2) Open the sample HTML file 'jsspell.html' with your favorite browser.
(3) Open a BDICT file in the test page.
(4) Type a word in the "Word" input box and press the "OK" button.
