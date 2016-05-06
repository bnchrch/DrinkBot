'use strict';

var util = require('util');
var config = require('./config');
var Bartender = require('./bartender');
var Bot = require('slackbots');

const mvcExplained = `*Model-View-Controller* is best thought of as ordering a drink from a bartender

You enter a bar on a Friday night, and approach the bartender. Since the bar is already crowded, you push through a crowd until you finally catch the bartender’s attention, and you blurt out, “One Manhattan, please!”

You are the *user*, and your drink order is the *user request*. To you, the Manhattan is just your favorite drink, and you pretty reliably know that this will be a sweet and delicious drink.
The bartender gives you a quick nod. To the bartender, the Manhattan is not a tasty drink, it is merely a series of steps:
>1. Grab glass
>2. Add whiskey
>3. Add vermouth
>4. Add bitters
>5. Stir drink
>6. Add cherry
>7. Ask for credit card and charge.

The *bartender’s brain* is the *controller*. As soon as you say the word “Manhattan” in a language that they understand, the work begins. This work is similar in nature to making a margarita or strawberry daiquiri, but uses distinct ingredients that will never be confused. The bartender can only use the tools and resources that are behind the bar. This limited tool set is the *model*, and includes the following:
>1.Bartender’s hands
>2.Shakers/mixing equipment
>3.Liquors
>4.Mixes
>5.Glasses
>6.Garnishes

Perhaps at a fancier bar, they might have a *robot assistant!*   _cough_ Me _cough_   Or an automatic drink mixer. It does not matter to your particular bartender, who can only use the available resources.
Finally, the *finished drink* that you can see and consume is the *view*. The view is built out of the limited options from the model, and arranged and transmitted via the controller (that is, the bartender’s brain).`


/**
 * Util function to template the json from the bratender object into something presentable in slack
 * @param {object} message
 * @returns {boolean}
 * @private
 */
function templateRecipe(recipe) {
	if (recipe.error) return recipe.error + "\n\nTry typing `DrinkBot Help` if you're having a bit of trouble."; 

	var tasteString = recipe.tastes.map( taste => taste.text ).join(", ");	

	var ingredientString = recipe.ingredients.map( ingr => ingr.textPlain ).join('\n');

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
	for (let i = 0; i < this.users.length; i++) {
		if (this.users[i].name.toLowerCase() ==  this.settings.name.toLowerCase()) {
			this.user = this.users[i];
			break;
		}
	}

    this._postToChannels();
};


/**
 * Sends a welcome message in the channel
 * @private
 */
DrinkBot.prototype._welcomeMessage = function (channel) {
    this.postMessageToChannel(channel.name, 'Anyone up for a refreshing beverage?' +
        '\n\n I can find you a specific recipie or you can give me an idea of what you want and I can go find a drink that will match your taste.' +
        '\n\nType `' + this.name + ' help` to understand how you can help me make your perfect drink!',
        {as_user: true});
}


/**
 * posts welcome message to non general channels drinkbot is a member of
 * @private */
DrinkBot.prototype._postToChannels = function () {
    // ensure the bot only posts to channels he's a member of and is not mandatory to be in
    var channels = this.channels.filter(this._isPermittedChannel);

    // filter being a dick
    for (let i = 0; i < channels.length; i++) {
        this._welcomeMessage(channels[i]);
    } 
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

    if (originalMessage.text.toLowerCase().indexOf('explain mvc') > -1 ) {
        self.postMessageToChannel(channel.name, "Yes of course!", {as_user: true})
        self.postMessageToChannel(channel.name, mvcExplained, {as_user: true})
        self.postMessageToChannel(channel.name, "Don't believe me? well here's the same thing but from a source more prone to error:\nhttps://medium.freecodecamp.com/model-view-controller-mvc-explained-through-ordering-drinks-at-the-bar-efcba6255053", {as_user: true})
    } else if (originalMessage.text.toLowerCase().indexOf('help') > -1 ) {
    	self.postMessageToChannel(channel.name,
    		"Here's a very specific example:\n\n" +
    		"`DrinkBot make me a sour drink with bourbon or tequila and pineapple juice that takes average skill to make that was given a gte90 rating`\n\n" +
    		"You probably don't want to be that specific as my recipe book isn't that extensive but you get the gist, besides\n\n" +
    		"`DrinkBot make me a drink with coke`\n\nwill do most just fine.\n\n" +
    		"Alternatively you can also request a specific drink in the following fashion:\n" +
    		"`DrinkBot I want a Negroni`\n", {as_user: true});
    } else {
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
    var channelObj = this._getChannelById(message.channel);

    return typeof message.channel === 'string' &&
        message.channel[0] === 'C' &&
        this._isPermittedChannel(channelObj);
        ;
};

/**
 * Util function to check if a given real time message object is from a channel drink bot
 * can post to.
 * @param {object} message
 * @returns {boolean}
 * @private
 */
DrinkBot.prototype._isPermittedChannel = function (channel) {
    return channel.is_member && !channel.is_general;
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
    return this.channels.filter( item => item.id === channelId)[0];
};

module.exports = DrinkBot;
