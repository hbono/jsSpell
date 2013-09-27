// Copyright 2013 Hironori Bono. All Rights Reserved.
// @author {Hironori Bono}

// Create a namespace 'org.jsspell' used in this file.
var org = org || {};
org.jsspell = {};

/**
 * Whether this file is compiled by the closure compiler.
 * @define {boolean}
 */
org.jsspell.COMPILED = false;

/**
 * Whether to enable the debugging code in this library.
 * @define {boolean}
 */
org.jsspell.DEBUG = false;

/**
 * Whether to create a NodeJS module.
 * @define {boolean}
 */
org.jsspell.NODEJS = false;

/**
 * A reference to the global context. The type of this object depends on the
 * context where this system is executed. For example, when this system runs on
 * a Web Worker, this type becomes 'WorkerContext'. On the other hand, when this
 * system runs on an iframe, this type becomes 'Window'.
 * @type {Object}
 * @const
 */
org.jsspell.global = this;

/**
 * Parses a string representing a decimal number or a hexadecimal one and
 * returns an integral number.
 * @param {string} s
 * @return {number}
 */
org.jsspell.parseFloat = function(s) {
  return (/** @type{number} */ (/** @type{*} */ (s))) - 0;
};

/**
 * Parses a string representing a decimal number or a hexadecimal one and
 * returns an integral number.
 * @param {string} s
 * @return {number}
 */
org.jsspell.parseInt = function(s) {
  return ~~(/** @type{number} */ (/** @type{*} */ (s)));
};

/**
 * Writes a log message to a debug console.
 * @param {*} message
 */
org.jsspell.log = function(message) {
  if (org.jsspell.DEBUG) {
    var jsConsole = org.jsspell.global.console;
    if (jsConsole && jsConsole.log) {
      jsConsole.log(message);
    }
  }
};

/**
 * Writes a warning message to a debug console.
 * @param {*} message
 */
org.jsspell.warn = function(message) {
  if (org.jsspell.DEBUG) {
    var jsConsole = org.jsspell.global.console;
    if (jsConsole && jsConsole.warn) {
      jsConsole.warn(message);
    }
  }
};

/**
 * Exposes an object and its methods to the global namespace path.
 * @param {string} name
 * @param {Object} object
 * @param {Object.<string,Function>} methods
 */
org.jsspell.exportObject = function(name, object, methods) {
  if (!org.jsspell.COMPILED || org.jsspell.NODEJS) {
    return;
  }
  var parts = name.split('.');
  var cur = self;
  var length = parts.length - 1;
  for (var i = 0; i < length; ++i) {
    var part = parts[i];
    if (cur[part]) {
      cur = cur[part];
    } else {
      cur = cur[part] = {};
    }
  }
  cur[parts[length]] = object;
  for (var key in methods) {
    object.prototype[key] = methods[key];
  }
};

/**
 * Reads a 16-bit value.
 * @param {Uint8Array} data
 * @param {number} offset
 * @return {number}
 */
org.jsspell.read16 = function(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
};

/**
 * Reads a 32-bit value.
 * @param {Uint8Array} data
 * @param {number} offset
 * @return {number}
 */
org.jsspell.read32 = function(data, offset) {
  return data[offset] | (data[offset + 1] << 8) |
      (data[offset + 2] << 16) | (data[offset + 3] << 24);
};

/**
 * Reads a list of NUL-terminated UTF-8 strings and returns a list of UTF-16
 * strings.
 * @param {Uint8Array} data
 * @param {number} head
 * @param {number} tail
 * @return {Array.<string>}
 */
org.jsspell.readTokens = function(data, head, tail) {
  /** @type {Array.<string>} */ var tokens = [];
  /** @type {Array.<number>} */ var token = [];
  var code = 0;
  var length = 0;
  while (head < tail) {
    /** @const {number} */ var n = data[head];
    ++head;
    if (n == 0) {
      // This is a NUL character ('\0').
      if (token.length > 0) {
        tokens.push(String.fromCharCode.apply(null, token));
        token = [];
      }
      code = 0;
      length = 0;
    } else if (length == 0) {
      // This is the first byte of a UTF-8 character.
      if (n < 0x80) {
        token.push(n);
      } else if (n < 0xc0) {
        return tokens;
      } else if (n < 0xe0) {
        code = n & 0x1f;
        length = 1;
      } else if (n < 0xf0) {
        code = n & 0x0f;
        length = 2;
      } else if (n < 0xf8) {
        code = n & 0x07;
        length = 3;
      } else {
        return tokens;
      }
    } else if (n < 0x80 || n >= 0xe0) {
      // This byte is not a valid trailing bytes of a UTF-8 character while we
      // are reading them.
      return tokens;
    } else {
      code = (code << 6) | (n & 0x3f);
      if (--length == 0) {
        if (code < 0x10000) {
          token.push(code);
        } else {
          code -= 0x10000;
          token.push(0xd800 + (code & 0x3ff), 0xdc00 + ((code >> 10) & 0x3ff));
        }
      }
    }
  }
  return tokens;
};

/**
 * An interface that observes events sent by org.jsspell.Rule
 * objects.
 * @interface
 */
org.jsspell.RuleListener = function() {};

/**
 * Called when a spellchecker finds a word stem matching to an affix rule.
 * @param {string} word
 * @param {string} flag
 * @return {boolean}
 */
org.jsspell.RuleListener.prototype.handleMatch = function(word, flag) {};

/**
 * Called when a spellchecker finds a suggestion matching to a suggestion rule.
 * @param {string} word
 * @return {boolean}
 */
org.jsspell.RuleListener.prototype.handleSuggestion = function(word) {};

/**
 * A base class that retrieves (possible) stems of a word.
 * @param {Array.<string>=} opt_token
 * @constructor
 */
org.jsspell.Rule = function(opt_token) {
  if (opt_token && opt_token.length > 3) {
    var strip = opt_token[2];
    var affix = opt_token[3];
    var condition = opt_token[4] || '';

    /**
     * A prefix or a suffix to be added to words.
     * @const {string}
     * @protected
     */
    this.affix = affix;

    /**
     * a string to be stripped by this rule. When this rule is a prefix rule,
     * it strips this string from the beginning of a matching word. On the other
     * hand, if this rule is a suffix rule, it strips this string from the end
     * of a matching word.
     * @const {string}
     * @protected
     */
    this.strip = (strip == '0') ? '' : strip;

    /**
     * A string representing the condition to apply this rule.
     * @const {string}
     * @protected
     */
    this.condition = (condition == '.') ? '' : condition;

    /**
     * A regular expression created from the |condition_| member. (This regular
     * expression is created the first time when this rule is used.)
     * @type {?RegExp}
     * @private
     */
    this.expression_ = null;
  }
};

/**
 * Applies this rule to the specified word and returns its stem. If 
 * @param {string} word
 * @param {string} flag
 * @param {org.jsspell.RuleListener} listener
 * @return {boolean}
 */
org.jsspell.Rule.prototype.applyRule = function(word, flag, listener) {
  if (word.length <= this.affix.length) {
    return true;
  }
  var stem = this.getStem_(word);
  if (stem.length == 0) {
    return true;
  }
  if (this.condition.length != 0) {
    if (!this.expression_) {
      this.expression_ = new RegExp(this.getExpression_());
    }
    if (!this.expression_.test(stem)) {
      return true;
    }
  }
  return listener.handleMatch(stem, flag);
};

/**
 * Returns a stem word from which the specified word is derived.
 * @param {string} word
 * @return {string}
 * @private
 */
org.jsspell.Rule.prototype.getStem_ = function(word) {
  return '';
};

/**
 * Returns a regular expression representing the condition when we should
 * apply this rule.
 * @return {string}
 * @private
 */
org.jsspell.Rule.prototype.getExpression_ = function() {
  return '';
};

/**
 * A class implementing a suffix rule used by the Chromium spellchecker.
 * @param {Array.<string>} token
 * @extends {org.jsspell.Rule}
 * @constructor
 */
org.jsspell.PrefixRule = function(token) {
  org.jsspell.Rule.call(this, token);
};
org.jsspell.PrefixRule.prototype = new org.jsspell.Rule;

/** @override */
org.jsspell.PrefixRule.prototype.getStem_ = function(word) {
  var offset = this.affix.length;
  var prefix = word.substring(0, offset);
  if (prefix != this.affix) {
    return '';
  }
  var suffix = word.substring(offset);
  if (this.strip.length != 0) {
    suffix = this.strip + suffix;
  }
  return suffix;
};

/** @override */
org.jsspell.PrefixRule.prototype.getExpression_ = function() {
  return '^' + this.condition;
};

/**
 * A class implementing a suffix rule used by the Chromium spellchecker.
 * @param {Array.<string>} token
 * @extends {org.jsspell.Rule}
 * @constructor
 */
org.jsspell.SuffixRule = function(token) {
  org.jsspell.Rule.call(this, token);
};
org.jsspell.SuffixRule.prototype = new org.jsspell.Rule;

/** @override */
org.jsspell.SuffixRule.prototype.getStem_ = function(word) {
  var offset = word.length - this.affix.length;
  var suffix = word.substring(offset);
  if (suffix != this.affix) {
    return '';
  }
  var prefix = word.substring(0, offset);
  if (this.strip.length != 0) {
    prefix += this.strip;
  }
  return prefix;
};

/** @override */
org.jsspell.SuffixRule.prototype.getExpression_ = function() {
  return this.condition + '$';
};

/**
 * A class representing a set of affix rules. An "affix rule" of hunspell is
 * actually a set of string-replacement rules.
 *   PFX A Y 1
 * @param {Array.<string>} token
 * @constructor
 */
org.jsspell.RuleSet = function(token) {
  var flag = token[1];
  var crossProduct = token[2];
  var count = token[3];

  /**
   * Whether this rule set can be applied after another rule has been applied.
   * @const {boolean}
   * @protected
   */
  this.crossProduct = crossProduct == 'Y';

  /**
   * A string used for identifying this rule set.
   * @const {string}
   * @private
   */
  this.flag_ = flag;

  /**
   * The number of rules in this set.
   * @const {number}
   * @private
   */
  this.count_ = count ? org.jsspell.parseInt(count) : 0;

  /**
   * @type {Array.<org.jsspell.Rule>}
   * @private
   */
  this.rules_ = [];
};

/**
 * Adds a rule to this rule set.
 * @param {org.jsspell.Rule} rule
 */
org.jsspell.RuleSet.prototype.addAffixRule = function(rule) {
  this.rules_.push(rule);
};

/**
 * Applies all rules in this set and calls the specified callback function if
 * there is a rule matching to the specified word.
 * @param {string} word
 * @param {org.jsspell.RuleListener} listener
 * @return {boolean}
 */
org.jsspell.RuleSet.prototype.applyRules = function(word, listener) {
  var index = this.rules_.length;
  while (--index >= 0) {
    if (!this.rules_[index].applyRule(word, this.flag_, listener)) {
      return false;
    }
  }
  return true;
};

/**
 * A class implementing a REP rule of hunspell, a string-replacement rule used
 * to find suggestions for a misspelled word.
 * @param {string} key
 * @param {string} replacement
 * @constructor
 */
org.jsspell.ReplaceRule = function(key, replacement) {
  /**
   * @const {string}
   * @private
   */
  this.key_ = key;

  /**
   * @const {string}
   * @private
   */
  this.replacement_ = replacement;
};

/**
 * Applies this replacement rule to the word and checks if replaced words are
 * correctly spelled.
 * @param {string} word
 * @param {org.jsspell.RuleListener} listener
 * @return {boolean}
 */
org.jsspell.ReplaceRule.prototype.applyRule = function(word, listener) {
  var keySize = this.key_.length;
  var index = 0;
  while ((index = word.indexOf(this.key_, index)) >= 0) {
    var newWord = (index == 0) ? '' : word.substring(0, index);
    newWord += this.replacement_;
    newWord += word.substring(index + keySize);
    if (!listener.handleSuggestion(newWord)) {
      return true;
    }
    index += keySize;
  }
  return false;
};

/**
 * A class that represents a dictionary used by the spellchecker class.
 * @param {Uint8Array} data
 * @param {number} size
 * @constructor
 */
org.jsspell.Dictionary = function(data, size) {
  var affix = org.jsspell.read32(data, 8);
  if (affix < 0 || affix >= size) {
    org.jsspell.warn('Corrupted BDIC data');
    return;
  }
  var group = org.jsspell.read32(data, affix);
  var rule = org.jsspell.read32(data, affix + 4);
  var replace = org.jsspell.read32(data, affix + 8);
  var other = org.jsspell.read32(data, affix + 12);

  /**
   * The major version of this dictionary.
   * @const {number}
   */
  this.major = org.jsspell.read16(data, 4);

  /**
   * The minor version of this dictionary.
   * @const {number}
   */
  this.minor = org.jsspell.read16(data, 6);

  /**
   * The offset to the trie of words.
   * @const {number}
   */
  this.dictionary = org.jsspell.read32(data, 12);

  /**
   * A mapping table from an affix ID (attached to a word) to a set of affix
   * rules.
   * @const {Array.<string>}
   * @private
   */
  this.affixGroups_ =
      org.jsspell.Dictionary.readAffixGroups_(data, group, rule);

  /**
   * Affix rules used for enumerating word stems.
   * @const {Array.<org.jsspell.RuleSet>}
   * @private
   */
  this.affixRules_ =
      org.jsspell.Dictionary.readAffixRules_(data, rule, replace);

  /**
   * Replacement rules used for enumerating suggestions of a misspelled word.
   * @const {Array.<org.jsspell.ReplaceRule>}
   * @private
   */
  this.replaceRules_ =
      org.jsspell.Dictionary.readReplaceRules_(data, replace, other);
};

/**
 * Creates a mapping from an affix ID to an affix group (a set of affix rules).
 * A BDIC file assigns a unique affix ID to a set of affix rules and attach
 * affix IDs to a word to represent its affixes.
 * @param {Uint8Array} data
 * @param {number} head
 * @param {number} tail
 * @return {Array.<string>}
 * @private
 */
org.jsspell.Dictionary.readAffixGroups_ = function(data, head, tail) {
  var tokens = org.jsspell.readTokens(data, head, tail);
  var groups = [''];
  for (var i = 1; i < tokens.length; ++i) {
    var token = tokens[i].split(' ');
    if (token.length != 2 || token[0] != 'AF') {
      return groups;
    }
    groups.push(token[1]);
  }
  return groups;
};

/**
 * Creates a list of affix rules from an affix section of a BDICT file. An affix
 * section of a BDICT file is a list of NUL-terminated strings, each of which
 * represents an affix rule and consists of four or five fields.
 * @param {Uint8Array} data
 * @param {number} head
 * @param {number} tail
 * @return {Array.<org.jsspell.RuleSet>}
 * @private
 */
org.jsspell.Dictionary.readAffixRules_ = function(data, head, tail) {
  var tokens = org.jsspell.readTokens(data, head, tail);
  var rules = [];
  var map = {};
  for (var i = 0; i < tokens.length; ++i) {
    var token = tokens[i].split(' ');
    if (token.length < 4) {
      return rules;
    }
    var command = token[0];
    var flag = token[1];
    if (!map[flag]) {
      var newRule = new org.jsspell.RuleSet(token);
      rules.push(newRule);
      map[flag] = newRule;
    } else if (command == 'SFX') {
      map[flag].addAffixRule(new org.jsspell.SuffixRule(token));
    } else if (command == 'PFX') {
      map[flag].addAffixRule(new org.jsspell.PrefixRule(token));
    }
  }
  return rules;
};

/**
 * Creates a list of character-replacement rules.
 * @param {Uint8Array} data
 * @param {number} head
 * @param {number} tail
 * @return {Array.<org.jsspell.ReplaceRule>}
 * @private
 */
org.jsspell.Dictionary.readReplaceRules_ = function(data, head, tail) {
  var tokens = org.jsspell.readTokens(data, head, tail);
  var replaces = [];
  var length = tokens.length & ~1;
  for (var i = 0; i < length; i += 2) {
    replaces.push(new org.jsspell.ReplaceRule(tokens[i], tokens[i + 1]));
  }
  return replaces;
};

/**
 * Applies all affix rules in this dictionary to the specified word. When there
 * is a rule matching to the word, it calls a callback of the specified
 * listener.
 * @param {string} word
 * @param {org.jsspell.RuleListener} listener
 * @return {boolean}
 */
org.jsspell.Dictionary.prototype.applyRules = function(word, listener) {
  var length = this.affixRules_.length;
  for (var i = 0; i < length; ++i) {
    if (!this.affixRules_[i].applyRules(word, listener)) {
      return false;
    }
  }
  return true;
};

/**
 * Returns whether the specified rule is in the given list of affix IDs.
 * @param {Array.<number>} ids
 * @param {string} flag
 * @return {boolean}
 */
org.jsspell.Dictionary.prototype.findRule = function(ids, flag) {
  var length = ids.length;
  for (var i = 0; i < length; ++i) {
    var group = this.affixGroups_[ids[i]];
    if (group.indexOf(flag) >= 0) {
      return true;
    }
  }
  return false;
};

/**
 * Applies all affix rules in this dictionary to the specified word. When there
 * is a rule matching to the word, it calls a callback of the specified
 * listener.
 * @param {string} word
 * @param {org.jsspell.RuleListener} listener
 * @return {boolean}
 */
org.jsspell.Dictionary.prototype.getSuggestions = function (word, listener) {
  if (!listener.handleSuggestion(word.toUpperCase())) {
    return true;
  }
  var length = this.replaceRules_.length;
  for (var i = 0; i < length; ++i) {
    if (this.replaceRules_[i].applyRule(word, listener)) {
      return true;
    }
  }
  return true;
};

/**
 * A class that represents a word used by the spellchecker class to look up
 * BDICT data.
 * @param {string} word
 * @constructor
 */
org.jsspell.CharacterIterator = function(word) {
  /**
   * @const {Array.<number>}
   * @private
   */
  this.data_ = org.jsspell.CharacterIterator.convert_(word);

  /**
   * @type {number}
   * @private
   */
  this.head_ = -1;

  /**
   * @const {number}
   * @private
   */
  this.tail_ = this.data_.length - 1;
};

/**
 * Reads the next character from this stream and returns it.
 * @return {number}
 */
org.jsspell.CharacterIterator.prototype.getChar = function() {
  if (this.head_ >= this.tail_) {
    return 0;
  }
  return this.data_[++this.head_];
};

/**
 * Creates a list of UTF-8 characters (used by this class) from the specified
 * string.
 * @param {string} word
 * @return {Array.<number>}
 * @private
 */
org.jsspell.CharacterIterator.convert_ = function(word) {
  // Convert the given UTF-16 string into a UTF-8 string and push its characters
  // to an array byte by byte.
  var length = word.length;
  var data = [];
  var lead = 0;
  for (var i = 0; i < length; ++i) {
    var code = word.charCodeAt(i);
    // When the previous character is the first character of a surrogate pair,
    // combine this code with the previous character and create a Unicode
    // code-point.
    if (lead != 0) {
      if (0xdc00 <= code && code < 0xe000) {
        code = 0x10000 | ((lead - 0xd800) << 10) | (code - 0xdc00);
      } else {
        // This code is not the second character of a surrogate pair, i.e. this
        // surrogate pair is corrupted.
        return data;
      }
      lead = 0;
    }
    if (code < 0x80) {
      data.push(code);
      continue;
    }
    if (0xd800 <= code && code < 0xdc00) {
      // This code seems to be the first character of a surrogate pair. Save
      // this character and see the next code.
      lead = code;
      continue;
    }
    var c0 = 0x80 | (code & 0x3f);
    code >>= 6;
    if (code < 0x20) {
      // 0x20 = 0x0800 >> 6.
      // This code is a 2-byte code, i.e. U+0080 to U+07FF.
      data.push(0xc0 | code, c0);
      continue;
    }
    var c1 = 0x80 | (code & 0x3f);
    code >>= 6;
    if (code < 0x10) {
      // 0x10 = 0x10000 >> 12.
      // This code is a 3-byte code, i.e. U+0800 to U+FFFF
      data.push(0xe0 | code, c1, c0);
      continue;
    }
    var c2 = 0x80 | (code & 0x3f);
    code >>= 6;
    if (code < 0x08) {
      // 0x08 = 0x200000 >> 18.
      // This code is a 4-byte code, i.e. U+10000 to U+1FFFFF.
      data.push(0xf0 | code, c2, c1, c0);
    } else {
      // This code is a 5-byte code or a 6-byte one, i.e. U+20000 to U+7FFFFFFF.
      // UTF-16 cannot represent these Unicode characters, i.e. the given string
      // is not a valid UTF-16 string.
      return data;
    }
  }
  return data;
};

/**
 * A class that represents a node in the dictionary trie of a BDICT file.
 * @param {Uint8Array} data
 * @param {number} offset
 * @constructor
 */
org.jsspell.Node = function(data, offset) {
  /**
   * A byte array representing BDict data.
   * @type {Uint8Array}
   * @private
   */
  this.data_ = data;

  /**
   * An offset from the beginning of the byte array to this node.
   * @type {number}
   * @private
   */
  this.offset_ = offset;
};

/**
 * Looks up this node and returns the location of a child node.
 * @param {org.jsspell.CharacterIterator} word
 * @return {number}
 */
org.jsspell.Node.prototype.lookup = function(word) {
  return -1;
};

/**
 * Returns affix IDs associated with this node.
 * @return {Array.<number>}
 */
org.jsspell.Node.prototype.getAffixIDs = function() {
  return [];
};

/**
 * A class that represents a leaf node. A leaf node consists of one mandatory
 * field (header) and two optional fields (additional_string and affix_list).
 *   field               size
 *   header              2
 *   [additional_string] ?
 *   [affix list]        ?
 * @extends {org.jsspell.Node}
 * @constructor
 */
org.jsspell.LeafNode = function(data, offset) {
  org.jsspell.Node.call(this, data, offset);

  /**
   * A list of affix IDs associated with this node.
   * @type {Array.<number>}
   * @private
   */
  this.affixes_ = [];
};
org.jsspell.LeafNode.prototype = new org.jsspell.Node(null, 0);

/** @override */
org.jsspell.LeafNode.prototype.lookup = function(word) {
  // A leaf node starts with a 2-byte header "0ABCCCCC CCCCCCCC". This header
  // consists of four fields list in the following table.
  //   field bits size description
  //   A     14   1    An additional-string flag, representing whether this node
  //                   has an additional string.
  //   B     13   1    An affix flag, representing whether this node has a list
  //                   of affix IDs.
  //   C     0    13   The first affix ID. This field is valid when its value is
  //                   not 0x1fff.
  /** @const {number} */ var FLAG_STRING = 0x40;
  /** @const {number} */ var FLAG_AFFIX = 0x20;
  /** @const {number} */ var FLAG_AFFIXID = 0x1fff;
  var offset = this.offset_;
  /** @const {number} */ var flag = this.data_[offset];
  var affix = ((flag << 8) | this.data_[++offset]) & FLAG_AFFIXID;
  if (flag & FLAG_STRING) {
    var code = 0;
    while ((code = this.data_[++offset]) != 0) {
      if (word.getChar() != code) {
        return -1;
      }
    }
  }
  if (word.getChar() != 0) {
    return -1;
  }
  if (affix != FLAG_AFFIXID) {
    this.affixes_.push(affix);
  }
  if (flag & FLAG_AFFIX) {
    do {
      affix = this.data_[++offset];
      affix |= this.data_[++offset] << 8;
      this.affixes_.push(affix);
    } while (affix != 0xffff);
  }
  return 0;
};

/** @override */
org.jsspell.LeafNode.prototype.getAffixIDs = function() {
  return this.affixes_;
};

/**
 * A class that represents a list node. A list node consists of two fields
 * (header and items). Each item of this node is a pair of a key and a value.
 *   field  size
 *   header 1
 *   items  *
 * @extends {org.jsspell.Node}
 * @constructor
 */
org.jsspell.ListNode = function(data, offset) {
  org.jsspell.Node.call(this, data, offset);
};
org.jsspell.ListNode.prototype = new org.jsspell.Node(null, 0);

/** @override */
org.jsspell.ListNode.prototype.lookup = function(word) {
  // A list node starts with a 1-byte header "111ABBBB".
  //   field bits size description
  //   A     4    1    The size of an entry. 1 represents two bytes and 0 means
  //                   one byte, respectively.
  //   B     0    4    The length of this list.
  var offset = this.offset_;
  /** @const {number} */ var FLAG_COUNT = 0x0f;
  /** @const {number} */ var FLAG_SIZE = 0x10;
  /** @const {number} */ var flag = this.data_[offset];
  /** @const {number} */ var size = (flag & FLAG_SIZE) ? 2 : 1;
  /** @const {number} */ var count = flag & FLAG_COUNT;
  /** @const {number} */ var key = word.getChar();
  for (var i = 0; i < count; ++i) {
    if (key == this.data_[++offset]) {
      var value = this.data_[++offset];
      if (size == 1) {
        offset = count * 2 + value;
      } else {
        value |= this.data_[++offset] << 8;
        offset = count * 3 + value;
      }
      return this.offset_ + 1 + offset;
    }
    offset += size;
  }
  return -1;
};

/**
 * A class that represents a lookup node. A lookup node consists of four
 * mandatory fields (header, first_char, table_size, and entries) and one
 * optional field: nul_entry.
 *   field       size   description
 *   header      1
 *   first_char  1
 *   table_size  1
 *   [nul_entry] 2 or 4
 *   entries     *
 * @extends {org.jsspell.Node}
 * @constructor
 */
org.jsspell.LookupNode = function(data, offset) {
  org.jsspell.Node.call(this, data, offset);
};
org.jsspell.LookupNode.prototype = new org.jsspell.Node(null, 0);

/** @override */
org.jsspell.LookupNode.prototype.lookup = function(word) {
  // A lookup node starts with a 1-byte header "110000AB".
  //   field bits size description
  //   A     1    1    The size of an entry. 1 represents four bytes and 0 means
  //                   two bytes, respectively.
  //   B     0    1    Whether this table has a special entry for NUL characters
  //                   ('\0').
  var offset = this.offset_;
  /** @const {number} */ var FLAG_NUL = 0x01;
  /** @const {number} */ var FLAG_SIZE = 0x02;
  /** @const {number} */ var flag = this.data_[offset];
  /** @const {number} */ var first = this.data_[++offset];
  /** @const {number} */ var size = this.data_[++offset];

  // Retrieve the table index for the current character.
  var index = word.getChar();
  /** @const {number} */ var nulFlag = flag & FLAG_NUL;
  if (index == 0) {
    // This character is a NUL character. Return an error unless this table has
    // a special entry for NUL characters.
    if (nulFlag == 0) {
      return -1;
    }
  } else {
    index -= first;
    if (index < 0| index >= size) {
      return -1;
    }
    index += nulFlag;
  }
  // Look up the table and retrieve the offset to the child node.
  if (flag & FLAG_SIZE) {
    index = offset + 4 * index;
    offset = org.jsspell.read32(this.data_, ++index);
  } else {
    index = offset + 2 * index;
    offset = org.jsspell.read16(this.data_, ++index);
    offset += this.offset_;
  }
  return offset;
};

/**
 * A factory class that creates Node objects from dictionary data.
 * @param {Uint8Array} data
 * @constructor
 */
org.jsspell.NodeFactory = function(data) {
  /**
   * The dictionary data.
   * @const {Uint8Array}
   * @private
   */
  this.data_ = data;
};

/**
 * Creates a Node object with the specified location of the dictionary.
 * @param {number} offset
 * @return {org.jsspell.Node}
 */
org.jsspell.NodeFactory.prototype.createNode = function(offset) {
  // A spellchecker dictionary used by Chromium is a trie consisting of three
  // types of nodes (leaf, lookup, and list) and its first byte is encoded as
  // listed in the table below.
  //   Type   Byte 1    Mask Type
  //   Lookup 110000xx  0xfc 0xc0
  //   List   111xxxxx  0xe0 0xe0
  //   Leaf   0xxxxxxx  0x80 0x00
  // This code reads the first byte and creates a Node object matching to its
  // value.
  /** @const {number} */ var LOOKUP_MASK = 0xfc;
  /** @const {number} */ var LOOKUP_TYPE = 0xc0;
  /** @const {number} */ var LIST_MASK = 0xe0;
  /** @const {number} */ var LIST_TYPE = 0xe0;
  /** @const {number} */ var LEAF_MASK = 0x80;
  /** @const {number} */ var LEAF_TYPE = 0x00;
  var type = this.data_[offset];
  if ((type & LOOKUP_MASK) == LOOKUP_TYPE) {
    return new org.jsspell.LookupNode(this.data_, offset);
  } else if ((type & LIST_MASK) == LIST_TYPE) {
    return new org.jsspell.ListNode(this.data_, offset);
  } else if ((type & LEAF_MASK) == LEAF_TYPE) {
    return new org.jsspell.LeafNode(this.data_, offset);
  } else {
    return null;
  }
};

/**
 * @param {Uint8Array} data
 * @param {number} size
 * @implements {org.jsspell.RuleListener}
 * @constructor
 */
org.jsspell.SpellChecker = function(data, size) {
  /**
   * The BDIC file.
   * @const {Uint8Array}
   * @private
   */
  this.data_ = data;

  /**
   * The size of the BDIC file.
   * @const {number}
   * @private
   */
  this.size_ = size;

  /**
   * A spellchecker dictionary.
   * @type {org.jsspell.Dictionary}
   * @private
   */
  this.dict_ = null; //new org.jsspell.Dictionary(data, size);

  /**
   * A factory that creates Node objects.
   * @type {org.jsspell.NodeFactory}
   * @private
   */
  this.factory_ = new org.jsspell.NodeFactory(data);

  /**
   * Whether this dictionary has the word given by an application.
   * @type {boolean}
   * @private
   */
  this.found_ = false;

  /**
   * Whether this dictionary has the word given by an application.
   * @type {Array.<string>}
   * @private
   */
  this.suggestions_ = [];
};

/**
 * Finds the specified word in the spellchecker dictionary. This function is
 * expected to be called in the following two cases:
 * 1. Whether this dictionary has the word provided by an application, or;
 * 2. Whether this dictionary has a word stem generated by this spellchecker.
 * In the former case, this function returns just whether the dictionary has the
 * word. On the other hand, in the latter case, this function checks not only
 * whether this dictionary has the word stem, but also whether the word stem
 * can generate the original word provided by an application.
 * @param {string} word
 * @param {string} flag
 * @return {boolean}
 * @private
 */
org.jsspell.SpellChecker.prototype.findWord_ = function(word, flag) {
  org.jsspell.log('findWord_(): word="' + word + '".');
  // Traverse the dictionary trie.
  var iterator = new org.jsspell.CharacterIterator(word);
  var offset = this.dict_.dictionary;
  do {
    var node = this.factory_.createNode(offset);
    if (!node) {
      // There is an error in creating a node. (Probably this offset points to
      // invalid data.)
      return false;
    }
    offset = node.lookup(iterator);
    if (offset == 0) {
      // This word is in this dictionary. Return whether this node has the given
      // affix rule.
      if (flag.length == 0) {
        return true;
      }
      return this.dict_.findRule(node.getAffixIDs(), flag);
    }
  } while (offset > 0);

  // This word is not in the dictionary.
  return false;
};

/**
 * Tests whether the specified word is a correct one.
 * @param {string} word
 * @return {boolean}
 * @private
 */
org.jsspell.SpellChecker.prototype.testWord_ = function(word) {
  var found = this.findWord_(word, '');
  if (!found) {
    this.found_ = false;
    this.dict_.applyRules(word, this);
    if (!this.found_) {
      return false;
    }
  }
  this.suggestions_.push(word);
  return true;
};

/** @override */
org.jsspell.SpellChecker.prototype.handleMatch = function(word, flag) {
  // Find whether this dictionary has the given word stem. This function returns
  // true if it does not have the word to get the next candidate.
  this.found_ = this.findWord_(word, flag);
  return !this.found_;
};

/** @override */
org.jsspell.SpellChecker.prototype.handleSuggestion = function(word) {
  // Find whether this dictionary has the given word stem. This function returns
  // true if it does not have the word to get the next candidate.
  org.jsspell.log('handleSuggestion(): word="' + word + '".');
  this.testWord_(word);
  return true;
};

/**
 * Checks whether the specified word is a correctly-spelled word. If the
 * specified word is not a correct one and |opt_suggestions| is provided, this
 * function appends suggested words to the given list. This function is a
 * blocking function and it probably takes long time to find suggestions.
 * @param {string} word
 * @param {Array.<string>=} opt_suggestions
 * @return {boolean}
 */
org.jsspell.SpellChecker.prototype.spell = function(word, opt_suggestions) {
  // Initialize the spellchecker dictionary. If there is an error while
  // initializing it, return true to prevent treating all words as misspelled.
  if (!this.dict_) {
    this.dict_ = new org.jsspell.Dictionary(this.data_, this.size_);
    if (!this.dict_.dictionary) {
      return true;
    }
  }
  if (this.findWord_(word, '')) {
    return true;
  }
  // This word itself is NOT in this dictionary. Find possible stem words
  // generated with affix rules from the dictionary.
  this.found_ = false;
  this.dict_.applyRules(word, this);
  var found = this.found_;
  if (!found && opt_suggestions) {
    this.suggestions_ = opt_suggestions;
    this.dict_.getSuggestions(word, this);
  }
  return found;
};

// Export the org.jsspell.SpellChecker class and its spell method.
org.jsspell.exportObject('org.jsspell.SpellChecker', org.jsspell.SpellChecker, {
  'spell': org.jsspell.SpellChecker.prototype.spell
});

// Attach the org.jsspell.SpellChecker object to the module.exports object to
// export this spellchecker object on NodeJS. (This code is a little tricky to
// avoid compilation errors when compiling this file with the closure compiler.)
if (org.jsspell.NODEJS) {
  var module = module || {};
  var jsObject = org.jsspell.SpellChecker;
  if (org.jsspell.COMPILED) {
    var jsMethods = {
      'spell': org.jsspell.SpellChecker.prototype.spell
    };
    for (var key in jsMethods) {
      jsObject.prototype[key] = jsMethods[key];
    }
  }
  module['exports'] = jsObject;
}
