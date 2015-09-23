'use strict';

var util = require('util');
var config = require('./config');
var Bartender = require('./bartender');
var Bot = require('slackbots');

/**
 * Util function to template the json from the bratender object into something presentable in slack
 * @param {object} message
 * @returns {boolean}
 * @private
 */
function templateRecipe(recipe) {
	if (recipe.error) return recipe.error; 

	var tasteString = recipe.tastes.map( taste => {
		return taste.text;
	}).join(", ");	

	var ingredientString = recipe.ingredients.map( ingr => {
			return ingr.textPlain;
		}).join('\n');

	return `
${recipe.name} (${recipe.rating}%)
${recipe.image}
${recipe.descriptionPlain}

Ingredients:
${ingredientString}

Taste: ${tasteString}
`
}

/**
 * Constructor function. It accepts a settings object which should contain the following keys:
 *      token : the API token of the bot (mandatory)
 *      name : the name of the bot (will default to "drinkbot")
 *
 * @param {object} settings
 * @constructor
 *
 */
var DrinkBot = function Constructor() {
    this.settings = config;
    this.settings.name = this.settings.name || 'drinkbot';

    this.user = null;
};

// inherits methods and properties from the Bot constructor
util.inherits(DrinkBot, Bot);

/**
 * Run the bot
 * @public
 */
DrinkBot.prototype.run = function () {
    DrinkBot.super_.call(this, this.settings);

    this.on('start', this._loadBotUser);
    this.on('message', this._onMessage);
};

/**
 * On message callback, called when a message (of any type) is detected with the real time messaging API
 * @param {object} message
 * @private
 */
DrinkBot.prototype._onMessage = function (message) {
    if (this._isChatMessage(message) &&
        this._isChannelConversation(message) &&
        !this._isFromDrinkBot(message) &&
        this._isMentioningDrinkBot(message)
    ) {
        this._replyWithDrink(message);
    }
};

/**
 * Loads the user object representing the bot
 * @private
 */
DrinkBot.prototype._loadBotUser = function () {
    
    //filter was being a dick
	for (var i = 0; i < this.users.length; i++) {
		if (this.users[i].name.toLowerCase() ==  this.settings.name.toLowerCase()) {
			this.user = this.users[i];
			break;
		}
	}

    this._welcomeMessage();

};


/**
 * Sends a welcome message in the channel
 * @private
 */
DrinkBot.prototype._welcomeMessage = function () {
    this.postMessageToChannel(this.channels[0].name, 'Anyone up for a refreshing beverage?' +
        '\n\n I can find you a specific recipie or you can give me an idea of what you want and I can go find a drink that will match your taste.' +
        '\n\nType `' + this.name + ' help` to understand how you can help me make your perfect drink!',
        {as_user: true});
};

/**
 * Takes a users message and passes it to the bartender to find your perfect drink
 * @param {object} message
 * @returns {boolean}
 * @private
 */
DrinkBot.prototype._replyWithDrink = function (originalMessage) {
	var self = this
	var channel = self._getChannelById(originalMessage.channel);
    if (originalMessage.text.toLowerCase().indexOf('help') > -1 ) {
    	self.postMessageToChannel(channel.name,
    		"Here's a very specific example:\n\n" +
    		"`DrinkBot make me a sour drink with bourbon or tequila and pineapple juice that takes average skill to make that was given a gte90 rating`\n\n" +
    		"You probably don't want to be that specific as my recipe book isn't that extensive but you get the gist, besides\n\n" +
    		"`DrinkBot make me a drink with coke`\n\nwill do most just fine.\n\n" +
    		"Alternatively you can also request a specific drink in the following fashion:\n" +
    		"`DrinkBot I want a Negroni`\n", {as_user: true});
    }
    else {
    	Bartender(originalMessage.text, function (recipe) {
			self.postMessageToChannel(channel.name, templateRecipe(recipe), {as_user: true});
		});
    }

};

/**
 * Util function to check if a given real time message object represents a chat message
 * @param {object} message
 * @returns {boolean}
 * @private
 */
DrinkBot.prototype._isChatMessage = function (message) {
    return message.type === 'message' && Boolean(message.text);
};

/**
 * Util function to check if a given real time message object is directed to a channel
 * @param {object} message
 * @returns {boolean}
 * @private
 */
DrinkBot.prototype._isChannelConversation = function (message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C'
        ;
};

/**
 * Util function to check if a given real time message is mentioning drinkbot
 * @param {object} message
 * @returns {boolean}
 * @private
 */
DrinkBot.prototype._isMentioningDrinkBot = function (message) {
    return ~ message.text.toLowerCase().indexOf(this.settings.name.toLowerCase()) ||
        message.text.toLowerCase().indexOf(this.name) > -1;
};

/**
 * Util function to check if a given real time message has ben sent by the drinkbot
 * @param {object} message
 * @returns {boolean}
 * @private
 */
DrinkBot.prototype._isFromDrinkBot = function (message) {
    return message.user === this.user.id;
};

/**
 * Util function to get the name of a channel given its id
 * @param {string} channelId
 * @returns {Object}
 * @private
 */
DrinkBot.prototype._getChannelById = function (channelId) {
    return this.channels.filter(function (item) {
        return item.id === channelId;
    })[0];
};

module.exports = DrinkBot;
