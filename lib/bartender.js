'use strict';

var natural = require('natural');
var tokenizer = new natural.WordTokenizer();
var http = require('http');
var config = require('./config')


/**
 * Finds which of two values appears first in a given array
 * @param  {Array} array 
 * @param  {number|string|object|array} val1  
 * @param  {number|string|object|array} val2  
 * @return {number|string|object|array} either val1 or val2 depending on which appears first
 */
function lowestIndexOfTwo (array, val1, val2) {
	var index1 = array.indexOf(val1);
	var index2 = array.indexOf(val2);
	if (index1 === -1) {
		return index2;
	}
	
	else if (index2 === -1) {
		return index1;
	}
	
	else {
		return index1 > index2 ? index2 : index1;
	}
}


/**
 * Merges ingredients separated by spaces so that you can query abdb properly
 * @param  {Array} tokens - query tokens to be joined
 * @return {String}
 */
function mergeIngredients (tokens) {
	return tokens.join('-');
}


/**
 * Takes tokens of a query and formats them to adbd specifications, 
 * this means inserting and/or into with queries and formatting ingredients
 * with spaces
 * @param  {String[]} tokens - query tokens
 * @return {String[]} 
 */
function formatParams(tokens) {
	
	if (!tokens || tokens.length == 1) {
		return tokens;
	}
	var indexToSplit = lowestIndexOfTwo(tokens, 'and', 'or')
	
	if (indexToSplit === -1) {
		return [].concat(mergeIngredients(tokens));
	} 

	else {
		return formatParams(tokens.slice(0, indexToSplit))
		.concat(tokens.slice(indexToSplit, indexToSplit + 1))
		.concat(formatParams(tokens.slice(indexToSplit + 1)));
	}

}


/**
 * Takes a set of formatted tokens which represent how the url
 * should be formatted: i.e. ["bourbon", "and", "coconut-water", "or", "tequila"]
 * and turns it into a string representing a piece of the final url:
 * i.e. "bourbon/and/coconut-water/or/tequila".
 * The init token is used to prepend an extra piece to the final string and is optional.
 * @param  {string} initToken - Optional String to be prepended to final result
 * @param  {string[]} params    - url items to be converted to url string
 * @return {string}
 */
function paramsToUrl (initToken, params) {
	console.log("params: " + params);
	var finalTokens = formatParams(params);
	initToken ? finalTokens.unshift(initToken) : null;
	return finalTokens.join('/');
}


/**
 * Get the items of an array between to values, exclusive.
 * @param  {Array} query - Array to be extracted from
 * @param  {string|number} startToken - token to provide starting index
 * @param  {string|number} endToken - token to provide terminating index
 * @return {Array} items from query between start and end tokens
 */
function extractBetweenTokens(query, startToken, endToken) {
	var start = query.indexOf(startToken) + 1;
	var end = query.indexOf(endToken) > -1 ? query.indexOf(endToken) : query.length;
	return query.indexOf(startToken) !== -1 ? query.slice(start, end) : [];
}


/**
 * Extract section from query array and turn into url
 * @param  {Array} query - array of items to be extracted from
 * @param  {string} initToken - string to be prepended to url chunk
 * @param  {string} startToken - token that marks where in query to start extracting from
 * @param  {string} endToken   - token that marks where in query to stop extracting
 * @return {string} - url chunk to be used when querying API
 */
function getUrlParams(query, initToken, startToken, endToken) {
	var params = extractBetweenTokens(query, startToken, endToken);
	return params.length > 0 ? paramsToUrl(initToken, params) : null;
}


/**
 * Convert the message query into API url
 * @param  {Array} query - array of words used by user in message
 * @return {string} API query url
 */
function queryToUrl (query) {
	var urlTokens = [];
	urlTokens.push(config.baseUrl);
	if (query.indexOf('want') > -1){
		urlTokens.push(getUrlParams(query, null, 'want', null));
	}
	else
	{
		urlTokens.push(getUrlParams(query, 'with', 'with', 'that'));
		urlTokens.push(getUrlParams(query, 'tasting', 'me', 'drink'));
		urlTokens.push(getUrlParams(query, 'skill', 'takes', 'skill'));
		urlTokens.push(getUrlParams(query, 'rating', 'given', "rating"));	
		
	}
	urlTokens.push('?ApiKey=' + config.addbApiKey);
	return urlTokens.filter(Boolean).join('/');
}


/**
 * Randomly selects a drink for the user from drinks returns by query
 * @param  {Object[]} drinks - array of drinks
 * @return {Object} the JSON representation of drink recipe
 */
function serveDrink (drinks) {
	var drinks = JSON.parse(drinks).result;
	if (drinks && drinks.length > 0) {
		var drink = drinks[Math.floor(Math.random()*drinks.length)];
		drink.image = config.assetUrl + "/transparent-background-white/floor-reflection/200x200/" + drink.id + ".png";
		console.log("Drink: " + JSON.stringify(drink.id));
		return drink;
	}
	else {
		return {
			error: "Could not find you a drink, either you're too drunk to spell or just a little too needy!"
		}
	}
}


/**
 * get data from url
 * @param  {string} url - url to be queried
 * @return {Object} drink to be served
 */
function queryDrinks(url) {
    return new Promise((resolve, reject) => {
		http.get(url, function(response) {
	        var body = '';
	        response.on('data', function(d) {
	            body += d;
	        });
	        response.on('end', function() {
	            var drink = serveDrink(body);
	            resolve(drink);
	        });

    	});
	})

}


/**
 * Uses a natural language string to find a drink from the 
 * Absolut Drink Database: http://addb.absolutdrinks.com/docs/
 * @param  {string} requestString - stringing to parse for drink query
 * @param  {Function} callback - function to return the drink to
 * @return {Object} drink to be served
 */
function parseRequest (requestString, callback) {
	var tokens = tokenizer.tokenize(requestString.toLowerCase()).filter(i => i != 'a' );
	var query = tokens.map(token => {
		return token != 'coke' ? token != 'whisky' ? token != 'rye' ? token : 'rye-whiskey' : 'whiskey' : 'cola';
	});

	var url = queryToUrl(query);

	console.log("query: " + query)
	console.log(url);

	queryDrinks(url).then(callback);
}

module.exports = parseRequest