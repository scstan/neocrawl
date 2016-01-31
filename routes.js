'use strict'

const	db		= require('./neo4j_driver')
const	dbUrl	= 'https://neo-mylocalprod:Anh6LTkYAstuEzBqBBMwFQkqEzUgzEkQbQfNY9@prod-db-1.mylocalmcds.com/db/data/transaction/commit'

module.exports = function routes (router) {
	router.get('/testneo4j', function(req, res){
		sendResponse(db.query([{
		  "statement" : "MATCH (r:Restaurant) where r.idRestaurant = 10949 return collect({nrn: r.idRestaurant})"
		},
		{
			"statement" : "MATCH (r:Restaurant) where r.idRestaurant = 10949 return {nrn: r.idRestaurant}"
		},
		{
			"statement" : "MATCH (r:Restaurant) where r.idRestaurant = 10949 return r"
		}], dbUrl), res)
	})
}
function sendResponse(resPromise, res) {
	resPromise
			.then(function(result){
				res.send(result)
			})
			.catch(function(err){
				console.error(err)
			})
}
