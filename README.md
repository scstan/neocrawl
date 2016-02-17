<h1>neocrawl</h1>
<br>
<h4>DESCRIPTION</h4>
<h5><strong>NEOCRAWL</strong> is built as a service/microservice that mediates any listing, finding or filtering request between an api and a neo4j database. The communication is done over rest api.
<br>This service alows you to find/list any node from within your neo4j database using related nodes properties (from any relationship distance)
<br>It was build as light as possible and it's only purpose is to generate appropriate cypher queries based on given filters and not intens processing </h5>
<br>

``` Issues, Pull requests and Enhancement requests are very welcomed and encouraged ! :D```
<h4>REQUIREMENTS</h4>
<p>1. All neo4j database clients must have version of at least 2.2.0 for the setup part</p>
<p>&nbsp&nbsp&nbspThe search/listing works with lower versions but it's not recommended</p>
<p>&nbsp&nbsp&nbspIt is also recommended to use the latest stable neo4j version</p>
<p>2. Node.js version of at least v4.2.1</p>
<p>&nbsp&nbsp&nbsp In this case it is also recommended to use the latest stable node.js version</p>
<p>3. A unix/linux based environment for the service deployment </p>
<br>
<h4>DEPLOYMENT</h4>
<p>1. Clone the repo </p>
``` git clone https://github.com/scstan/neocrawl.git ``` 
<p>or</p>
``` git clone git@github.com:scstan/neocrawl.git ```
<p>2. Install all dependencies </p> 
``` npm install ```
<p>3. Edit the config.json with appropriate host and port to suit your needs </p>
<p>4. Start the service by starting either of app.js or clusters.js: </p>
``` node app.js / node cluster.js ```
<br>
<h4>USAGE</h4>
<p> This service provides 3 rest api endpoints. </p>
<p>1. SetupDB </p>
<p>This will generate a .json, in the graphs directory, with all the "models" in your database
<br>Every usage of this endpoint updates the .json with your lates database mapping 
<br>It is recommended to use this endpoint everytime you deploy you application
<br>Please note that this may take a bit depending on your database size</p>
``` POST {{base_url}}/api/setupdb```
```
{
    "dbAlias": "localhost",        // <= this will be the base_name for you .json [MANDATORY]
    "dbUrl": "localhost:7474"      // <= target neo4j database base_url or ip:port [MANDATORY]
}
```
<p>2. Get Graph </p>
<p> This will retrieve the generated map previously created using setupdb endpoint</p>
``` POST {{base_url}}/api/getgraph```
```
{
    "dbAlias": "localhost",        // <= this will be used to locate your mapped database [MANDATORY]
}
```
<p> Response example [the key in this returned map is the actual label of the node]</p>
```
{
  ...
  "User": {
    "relatedNodes": [
      "Role",
      "_Role"
    ],
    "properties": [
      ...
      "password",
      "id",
      "email",
      ...
    ]
  },
  ...
}
```
<p>3. Search </p>
<p> This is the main endpoint which retrieves results base on you request</p>

``` POST {{base_url}}/api/search```
```
{
    "dbAlias": "localhost",            // <= this will be used to locate your mapped database [MANDATORY]
    "node": "User",                    // <= requested node label [MANDATORY]
    "dbUrl": "http://localhost:7474/", // <= target db [MANDATORY]
    "offset": 1,                       // <= first page aka skip 0 [MANDATORY]
    "limit": 10,                       // <= self explanatory [MANDATORY]
    "orderBy": "idRestaurant",         // <= [OPTIONAL]
    "direction": "asc",                // <= [OPTIONAL]
    "debug": true,                     // <= prints out the generated neo4j cypher query [OPTIONAL]
    "filters": {                       // <= filters list [MANDATORY but can be left empty]
        "User.email": {
            "like": "@gmail"
        },
        "User.lastName": {
            "like":"smith"
        },
        "User.customImage":{
            "has": false
        }
    },
    "return":"{user:User, roles:collect(distinct(Role))}" 
              //  <= custom return must be a stringified representation. [OPTIONAL]. 
}             // if custom return is not provided the search will return a list of ids   
              // based on the requested node type
```

<h3>FILTERS </h3>
<p>The filter key is composed in the following manner LABEL.PROPERTY_NAME</p>
<p>Filters can be provided either by direct assignment</p>

```
"User.email": "eric@gmail.com"    // <= this defaults to the eq operator
```
<p>Or by picking an operator from the bellow list:</p>
```
ex: "User.lastName": {
            "like":"smith"
        }
```
```
'eq': = 
'lt': < 
'le': <=
'gt': >
'ge': >=
'ne': <> 
'in': checks that the given property [array] contains the given value 
'out': checks that the given property [array] does not contain the given value
'has': checks if the given property exists on the node [boolean]
'containsAny': checks that ANY of the elements from the value [array] is found in the given property [array]
'containsAll': checks that ALL of the elements from the value [array] is found in the given property [array]
'excludesAny': checks that ANY of the elements from the value [array] are not found in the given property [array]
'excludesAll': checks that ALL of the elements from the value [array] are not found in the given property [array]
'like': checks that property fully or partially contains the given value [number or string | case insensitive]
'regex': checks the given regex against the given property
```

<h4> Issues, Pull requests and Enhancement requests are very welcomed and encouraged ! :D<h4>
<p>The End</p>
