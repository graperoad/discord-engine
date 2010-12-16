/**
 * Mangled port of a command parser based on LPC/Discworld syntax.
 *
 * Provides objects with an add_command method which takes a command, such as
 * "pull" and a syntax, just as "<direct:object>".
 *
 * The Discworld parser is a marvel, so this will probably never be a complete
 * imitation.
 * 
 * @author Michelle Steigerwalt <msteigerwalt.com>
 * @copyright 2010 Michelle Steigerwalt
 */
AdvancedParser = new Class({

	Implements: CommandParser,

	commands: [],

	caller: null, //The living object calling the command.

	failure_message: null,

	getPatterns: function(command, commands) {
		commands = commands || this.commands;
		var com = commands[command];
		return (com) ? com.syntax : false;
	},

	getHandler: function(command, commands) {
		commands = commands || this.commands;
		var com = commands[command];
		return (com) ? com.method: false;
	},

	/**
	 * Takes an arguments string for a command and parses out the <> syntax
	 * arguments.  Mangled form of LPC/Discworld-based command strings.
	 */
	parseLine: function(line, caller, holder) {

		holder = holder || this;

		this.caller = caller;
		this.holder = holder;

		var words     = line.split(' ');
		var command   = words.shift();

		line = words.join(' ');

		var patterns = this.getPatterns(command, holder.commands);
		var handler  = this.getHandler(command, holder.commands);

		if (!patterns || !handler) { return false; }

		var result = false;
		patterns.each(function(syntax) {
			if (result) { return; }
			var args = this.extractArguments(syntax, line);
			if (!args) { return false; }
			var valid = true;
			args.each(function(obj, i) {
				if (!valid) { return; }
				args[i] = this.findObject(obj.tag, obj.str);
				if (!args[i]) {
					valid = false;
					var any = this.findAnyObject(obj.str, caller);
					if (!any) {
						result = "Cannot find '"+obj.str+"'.";
					} else {
						result = "You can't do that with "+any.get('definite')+".";
					}
				}
			}, this);
			if (valid && args && args.length) {
				result = handler.bind(this.holder).pass(args)();	
			}
		}, this);

		return result;

	},

	extractArguments: function(syntax, line) {

		//The ' is a delimiter within a tag for user-friendly syntax
		// display.
		var patt = /(<[\w:']*>)/g;
		var items = syntax.split(patt).filter(function(i) { 
			return (i) ? true : false;
		});

		//Matches all the delimiters, such as "with", "to", "from", etc.
		var delimiters = items.filter(function(i) { 
			return (i.match(patt)) ? false : true;
		});

		var valid = true;
		sections = [];

		//Use the delimiters to split the string into tags.
		delimiters.each(function(d) {
			if (!valid) { return; }
			var exp = new RegExp(d);
			if (!line.match(exp)) { 
				valid = false;
			} else {
				//Split the line at the first occurance of the delimiter.
				sections.push(line.replace(exp, '||').split('||'));
			}
		});

		/**
         * If there are no delimiters, it means we have only one tag, right?
		 * This is true at least for now -- otherwise, we'd have to do a
		 * word-by-word walk to match multiword phrases with no delimiters.
		 *
		 * I don't want to code that, do you?
		 */
		if (!delimiters.length) {
			sections = [line];
		}

		if (!valid) { return false; }

		sections = sections.flatten();

		var tags = items.filter(function(t) {
			return t.match(patt) ? true : false;
		});

		if (!tags) { return false; }

		valid = true;
		var args = [];
		sections.each(function(sec, i) {
			if (!tags[i]) { 
				valid = false; 
				return false;
			}
			//Optional '* match is for implementing user-friendly syntax
			//output.
			var tag = tags[i].replace(/^<|('[\w]+)?>$/g, '');
			args[i] =  {str: sec, tag: tag};
		});

		return (valid) ? args : false;

	},

	findObject: function(tag, words) {

		var caller = this.caller;
		var obj    = this.holder;

		var list = [];

		// A lot of reproduction of code here!  This will make it easier for people
		// to understand exactly what each tag will return.
		if (tag=='direct') {
			list.push(obj);
		} else if (tag == "object") {
			if (obj.container) {
				list.combine(obj.container.getItems());
			}
			if (caller.room) {
				list.combine(caller.room.getItems());
			}
		} else if (tag == "direct:living") {
			list.push(caller);
		} else if (tag == "direct:object") {
			list.push(obj);
		} else if (tag == "direct:player") {
			if (caller.player) { list.push(caller); }
		} else if (tag=="indirect") {
			if (obj.container) {
				list.combine(obj.container.getItems());
			}
			if (caller.room) {
				list.combine(caller.room.getLiving());
				list.combine(caller.room.getItems());
			}
			list.erase(caller);
			list.erase(obj);
		} else if (tag == "indirect:object") {
			if (obj.container) {
				list.combine(obj.container.getItems());
			}
			if (caller.room) {
				list.combine(caller.room.getItems());
			} list.erase(obj);
		} else if (tag == "indirect:object:me") {
			if (obj.container) {
				list.combine(obj.container.getItems());
			} list.erase(obj);
		} else if (tag == "indirect:object:here") {
			if (caller.room) {
				list.combine(caller.room.getItems());
			} list.erase(obj);
		} else if (tag == "indirect:object:me:here") {
			if (obj.container) {
				list.combine(obj.container.getItems());
			} 
			if (caller.room) {
				list.combine(caller.room.getItems());
			} list.erase(obj);
		} else if (tag == "indirect:object:here:me") {
			if (caller.room) {
				list.combine(caller.room.getItems());
			}
			if (obj.container) {
				list.combine(obj.container.getItems());
			} list.erase(obj);
		} else if (tag == "indirect:living") {
			if (caller.room) {
				list.combine(caller.room.getLiving().erase(obj));
			}
		} else if (tag == "indirect:player") {
			if (caller.room) {
				list.combine(caller.room.getPlayers().erase(obj));
			}
		} else if (tag == "string") {
			return words;
		} else if (tag == "number") {
			if (words.toInt()) { return words; }
		} else if (tag == "fraction") {
			
		} else if (tag == "preposition") {
			//I just threw a list of random prepositions together.
			var preps = [
				'on', 'in', 'under', 'of', 'around', 'above',
				'against', 'along', 'after', 'before', 'among',
				'beneath', 'beside', 'between', 'by', 'into', 
				'inside', 'past', 'to', 'towards', 'underneath', 
				'with', 'within'
			];
			if (preps.contains(words)) { return words; }
		} else {
			log_error("Unsupported command tag: "+tag);
			return false;
		}

		list = list.filter(function(item) { return (item.get) ? 1 : 0; });

		if (!list || !list.length) { return false; }

		return this.checkList(list, words) || false;

	},

	findAnyObject: function(words, parser) {
		var list = [];
		if (this.holder.container) {
			list.combine(this.holder.container.getItems());
		}
		if (this.caller.room) {
			list.combine(this.caller.room.getLiving());
			list.combine(this.caller.room.getItems());
		}
		return this.checkList(list, words);
	},

	checkList: function(list, words) {
		if (!list.length || !list || !words) { return false; }
		if (!list.each) { list = [list]; } //Splat

		list = list.filter(function(item) { return (item.get) ? true : false; });

		var match = false;
		list.each(function(item) {
			if (!match && item.matches(words)) {
				match = item;
			}
		});

		return match;
	}

});