// The namespace used by this application.
var test = {};

/**
 * @type {org.jsspell.SpellChecker}
 * @private
 */
test.spellchecker_ = null;

/**
 * Checks whether a word retrieved from an <input> element is a correct one and
 * writes its result.
 * @private
 */
test.checkWord_ = function () {
  var word = document.getElementById('word').value;
  var suggestions = [];
  var result = test.spellchecker_.spell(word, suggestions);

  var output = document.getElementById('result');
  output.textContent =
      'word=\"' + word + '\", ' +
      'result=' + result + ', ' +
      'suggestions=[' + suggestions.join() + ']';
};

/**
 * Called when a browser finishes loading a BDICT file.
 * @param {Event} event
 * @private
 */
test.handleLoad_ = function(event) {
  var data = new Uint8Array(event.target.result);
  test.spellchecker_ = new org.jsspell.SpellChecker(data, data.length);
  test.checkWord_();
};

/**
 * Called when a user clicks the "OK" button in the test page.
 * @param {Event} event
 * @private
 */
test.handleClick_ = function(event) {
  if (!test.spellchecker_) {
    var file = document.getElementById('bdic');
    if (file.files && file.files.length > 0) {
      var reader = new FileReader();
      reader.addEventListener('load', test.handleLoad_, false);
      reader.readAsArrayBuffer(file.files[0]);
    }
    return;
  }
  test.checkWord_();
};

/**
 * Called when a user clicks the "OK" button in the test page.
 * @param {Event} event
 * @private
 */
test.handleChange_ = function(event) {
  var file = event.target;
  if (file.files && file.files.length > 0) {
    test.spellchecker_ = null;
    var word = document.getElementById('word');
    word.disabled = false;
    var button = document.getElementById('submit');
    button.disabled = false;
  }
};

/**
 * Adds a file-input box to the specified element.
 * @param {Element} parent
 * @private
 */
test.addFileInput_ = function(parent) {
  var group = document.createElement('div');
  group.textContent = 'BDICT file: ';
  parent.appendChild(group);

  var bdic = document.createElement('input');
  bdic.type = 'file';
  bdic.id = 'bdic';
  bdic.addEventListener('change', test.handleChange_, false);
  group.appendChild(bdic);
};

/**
 * Adds a word-input box to the specified element.
 * @param {Element} parent
 * @private
 */
test.addWordInput_ = function(parent) {
  var group = document.createElement('div');
  group.textContent = 'Word: ';
  parent.appendChild(group);

  var word = document.createElement('input');
  word.type = 'text';
  word.id = 'word';
  word.value = 'A\'s';
  word.disabled = true;
  group.appendChild(word);

  var button = document.createElement('input');
  button.type = 'button';
  button.id = 'submit';
  button.value = 'OK';
  button.disabled = true;
  button.addEventListener('click', test.handleClick_, false);
  group.appendChild(button);

  var result = document.createElement('div');
  result.id = 'result';
  group.appendChild(result);
};

/**
 * Starts this test application.
 */
test.main = function() {
  document.title = 'Jspell Test';
  test.addFileInput_(document.body);
  test.addWordInput_(document.body);
};

window.onload = test.main;
