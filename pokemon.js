const fs = require('fs'); 
const http = require("http"); 
const path = require("path"); 
const express = require("express"); 
const bodyParser = require("body-parser"); 
const alert = require('alert'); 
const app = express();  
const portNumber = 5001; 
const GRAMS_TO_POUNDS = 0.00220462
const METER_TO_FEET = 3.28
let user; 
let loginName; 

process.stdin.setEncoding("utf8"); 
app.set("views", path.resolve(__dirname, "templates")); 
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));

require("dotenv").config({ path: path.resolve(__dirname, 'config/.env') })  

const username = process.env.MONGO_DB_USERNAME; 
const password = process.env.MONGO_DB_PASSWORD; 
const db = process.env.MONGO_DB_NAME; 
const collection = process.env.MONGO_COLLECTION;

const databaseAndCollection = {db: db, collection: collection}; 
	 
const { MongoClient, ServerApiVersion } = require('mongodb'); 
const res = require('express/lib/response');
const { response } = require('express');

const uri = `mongodb+srv://${username}:${password}@cluster0.f1xttpg.mongodb.net/?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 }); 


console.log("Web Server started and running at http://localhost:" + portNumber) 
const prompt = "Stop to shut down the server: "; 
process.stdout.write(prompt); 
	 
process.stdin.on("readable", function () { 
    let dataInput = process.stdin.read(); 
    if (dataInput !== null) { 
        let command = dataInput.trim(); 
        if (command === "stop") { 
            console.log("Shutting down the server"); 
            process.exit(0); 
            } 
            process.stdout.write(prompt); 
            process.stdin.resume(); 
        }  
}); 

app.use('/public', express.static('public'))
app.use(express.static("images"))

app.get("/", (request, response) => {
    user = ""
    response.render("index")
})

app.get("/registration", async (request, response) => {

    try {
        await client.connect(); 

        const {name, age, email, username, password} = request.query 
        if (name && age && email && username && password) {
            let result = await lookUpByUsername(client, databaseAndCollection, username)
            if (result) {
                alert("Username already exists!")
                response.render("registration")
            } else {
                let app = {name: name, age: age, email: email, username: username, password: password, team: []}
                await insertApp(client, databaseAndCollection, app)
                alert("Account made successfully!")
                response.render("index")
            }
        } else {
            response.render("signup")
        }
    } catch (e) { 
        console.error(e)
    } finally {
        await client.close()
    }
})
 
app.get("/login", async (request, response) => {

    try {
        await client.connect();
        let result =  await lookUpByUsername(client, databaseAndCollection, request.query.username);
        if (result) {
            loginName = result.name
        }
        let back = "http://localhost:5001/"
        if (result) {
            if (result.password == request.query.password) {

                const variables = {
                    name: result.name, 
                    team: await findTeam(result)
                }
                user = result.username
                response.render("login", variables)
            } else {
                alert("Incorrect password")
                response.render("index")
            }
        } else {
            alert("User does not exist!")
            response.render("index")
        }
    
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

})

app.post("/addPokemon", async (request, response) => {

    try {
        if (request.body.pokemonAdd) {
            let pokemon = request.body.pokemonAdd.toLowerCase()
            await client.connect();
            let result =  await lookUpByUsername(client, databaseAndCollection, user);
            let back = "http://localhost:5001/login?username=" + result.username + "&password=" + result.password
            let url = "https://pokeapi.co/api/v2/pokemon/" + pokemon
            let length = result.team.length

            if (result && (result.team == null || length < 6)) {
                let newValues = {team: pokemon} 
                if (!result.team.includes(pokemon)) {
                    const status = await fetch (url)
                    if (status.status == 404 || status.statusText == "Not Found") {
                        alert(pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is not a Pokemon!")
                        const variables = {
                            name: loginName, 
                            team: await findTeam(result)
                        }
                        response.render("login", variables)   
                    } else {
                        await insertPokemon(client, databaseAndCollection, user, newValues)
                        alert(pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is added to your team!")
                        
                        const variables = {
                            name: result.name, 
                            team: await findTeamAdd(result, pokemon)
                        }

                        response.render("login", variables)
                    } 
                } else {
                    alert(pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is already in your team!")
                    const variables = {
                        name: loginName, 
                        team: await findTeam(result)
                    }
                    response.render("login", variables)
                }
            } else { 
                alert("Your party is full!")
                const variables = {
                    name: loginName, 
                    team: await findTeam(result)
                }
                response.render("login", variables)
            }
        }
    } catch (e) {
        console.error(e);
    } 
})

app.post("/removePokemon", async (request, response) => {

    try {
        if (request.body.pokemonRemove) {
            let pokemon = request.body.pokemonRemove.toLowerCase()
            await client.connect();
            let result = await lookUpByUsername(client, databaseAndCollection, user) 
            let back = "http://localhost:5001/login?username=" + result.username + "&password=" + result.password
            
            if (result && (result.team == null || result.team.length > 0)) {
                let newValues = {team: pokemon} 
                if (result.team.includes(pokemon)) {
                    await removePokemon(client, databaseAndCollection, user, newValues)
                    alert(pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is released to the wild!")
                    
                    const variables = {
                        name: result.name, 
                        team: await findTeamRemove(result, pokemon)
                    }

                    response.render("login", variables)
                } else {
                    alert(pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is not on your team!")
                    const variables = {
                        name: loginName, 
                        team: await findTeamRemove(result, pokemon)
                    }
                    response.render("login", variables)
                }
            } else {
                alert("You don't have any Pokemon in your team!")
                const variables = {
                    name: loginName, 
                    team: await findTeam(result)
                }
                response.render("login", variables)
            }
        }
    } catch (e) {
        console.error(e);
    } 
})

app.post("/lookUp", async (request, response) => {
    if (request.body.lookUp) {
        let lookUp = request.body.lookUp
        await client.connect();
        let signIn = await lookUpByUsername(client, databaseAndCollection, user) 
        let back = "http://localhost:5001/login?username=" + signIn.username + "&password=" + signIn.password
        let result = await lookUpByUsername(client, databaseAndCollection, request.body.lookUp) 
        if (result) {

            const variables = {
                operation: lookUp.charAt(0) + lookUp.slice(1) + "'s Team", 
                msg: lookUp.charAt(0) + lookUp.slice(1) + "'s Team<br><br>" + await findTeam(result), 
                url: back
            }
            response.render("displayTeam", variables)   
        } else {
            alert("User not found")
            const variables = {
                name: loginName, 
                team: await findTeam(signIn)
            }
            response.render("login", variables)
        }
    }
})

app.post("/isAPokemon", async (request, response) => {
    if (request.body.query) {
        pokemon = request.body.query.toLowerCase() 
        let url = "https://pokeapi.co/api/v2/pokemon/" + pokemon
        await client.connect();
        let signIn = await lookUpByUsername(client, databaseAndCollection, user) 
        let status = await fetch(url)
        
        if (status.status == 404 || status.statusText == "Not Found") {
            alert(pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is not a Pokemon!")
            const variables = {
                name: loginName, 
                team: await findTeam(signIn)
            }
            response.render("login", variables)
        } else {
            alert(pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is a Pokemon!")
            const variables = {
                name: loginName, 
                team: await findTeam(signIn)
            }
            response.render("login", variables)
        }
    }
})

app.post("/pokedex", async (request, response) => {
    if (request.body.pokedex) {
        pokemon = request.body.pokedex.toLowerCase() 
        let url = "https://pokeapi.co/api/v2/pokemon/" + pokemon
        await client.connect();
        let signIn = await lookUpByUsername(client, databaseAndCollection, user) 
        let back = "http://localhost:5001/login?username=" + signIn.username + "&password=" + signIn.password
        let status = await fetch(url)
        
        if (status.status == 404 || status.statusText == "Not Found") {
            alert(pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is not a Pokemon!")
            const variables = {
                name: loginName, 
                team: await findTeam(signIn)
            }
            response.render("login", variables)
        } else {
            let pokedex = await status.json()
            let msg = "<img src=\"" + pokedex.sprites.other.dream_world.front_default + "\" alt=\"" + pokedex.name + "\" width=\"300\" height=\"300\"><br>"

            let types = []
            
            pokedex.types.forEach(element => {
                types.push(element.type.name.charAt(0).toUpperCase() + element.type.name.slice(1))
            });

            const variables = {
                img: msg, 
                name: pokedex.name.charAt(0).toUpperCase() + pokedex.name.slice(1), 
                hp: pokedex.stats[0].base_stat, 
                attack: pokedex.stats[1].base_stat, 
                defense: pokedex.stats[2].base_stat, 
                speed: pokedex.stats[5].base_stat,
                xp: pokedex.base_experience, 
                ability: pokedex.abilities[0].ability.name.charAt(0).toUpperCase() + pokedex.abilities[0].ability.name.slice(1), 
                types: types.join(' / '), 
                weight: Math.round(pokedex.weight * 1000 * GRAMS_TO_POUNDS) / 10 + "kg", 
                height: Math.floor((pokedex.height/10) * METER_TO_FEET) + "ft " + Math.round((((pokedex.height/10) * METER_TO_FEET) % 1).toFixed(2) * 10) + "in", 
                url: back 
            }
            response.render("pokedex", variables)
        }
    }
})

async function findTeamAdd(result, pokemon) {
    let msg = ""

    for (let i = 0; i < result.team.length; i++) {
        let url = "https://pokeapi.co/api/v2/pokemon/" + result.team[i]
        const status = await fetch (url)  
        let pokedex = await status.json()
        let src = pokedex.sprites.other.dream_world.front_default
        let name = pokedex.name.charAt(0).toUpperCase() + pokedex.name.slice(1)
        msg += "<figure style=\"display: inline-block\"><img src=\"" + src + "\" alt=\"" + name + "\" width=\"100\" height=\"100\"><figcaption style=\"text-align: center\">" + name + "</figcaption></figure>"
    }

    let url = "https://pokeapi.co/api/v2/pokemon/" + pokemon
    const status = await fetch (url)  
    let pokedex = await status.json()
    let src = pokedex.sprites.other.dream_world.front_default
    let name = pokedex.name.charAt(0).toUpperCase() + pokedex.name.slice(1)
    msg += "<figure style=\"display: inline-block\"><img src=\"" + src + "\" alt=\"" + name + "\" width=\"100\" height=\"100\"><figcaption style=\"text-align: center\">" + name + "</figcaption></figure>"

    return msg + "<br><br>"
}

async function findTeam(result) {
    let msg = ""

    for (let i = 0; i < result.team.length; i++) {
        let url = "https://pokeapi.co/api/v2/pokemon/" + result.team[i]
        const status = await fetch (url)  
        let pokedex = await status.json()
        let src = pokedex.sprites.other.dream_world.front_default
        let name = pokedex.name.charAt(0).toUpperCase() + pokedex.name.slice(1)
        msg += "<figure style=\"display: inline-block\"><img src=\"" + src + "\" alt=\"" + name + "\" width=\"100\" height=\"100\"><figcaption style=\"text-align: center\">" + name + "</figcaption></figure>"
    }

    return msg + "<br><br>"
}
 
async function findTeamRemove(result, pokemon) {
    let msg = ""
    for (let i = 0; i < result.team.length; i++) {
        if (result.team[i] != pokemon) {
            let url = "https://pokeapi.co/api/v2/pokemon/" + result.team[i]
            const status = await fetch (url)  
            let pokedex = await status.json()
            let src = pokedex.sprites.other.dream_world.front_default
            let name = pokedex.name.charAt(0).toUpperCase() + pokedex.name.slice(1)
            msg += "<figure style=\"display: inline-block\"><img src=\"" + src + "\" alt=\"" + name + "\" width=\"100\" height=\"100\"><figcaption style=\"text-align: center\">" + name + "</figcaption></figure>"
        }
    }
    return msg + "<br><br>"
}

async function insertApp(client, databaseAndCollection, newApp) { 
    const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newApp); 
} 

async function lookUpByEmail(client, databaseAndCollection, appEmail) {
    let filter = {email: appEmail};
    const result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);
    return result
}

async function lookUpByUsername(client, databaseAndCollection, appUser) {
    let filter = {username: appUser};
    const result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);
    return result || null
}

async function insertPokemon(client, databaseAndCollection, username, newValues) {
    let filter = {username : username};
    let update = { $push: newValues };

    const result = await client.db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .updateOne(filter, update);
}

async function removePokemon(client, databaseAndCollection, username, newValues) {
    let filter = {username : username};
    let update = { $pull: newValues };

    const result = await client.db(databaseAndCollection.db)
    .collection(databaseAndCollection.collection)
    .updateOne(filter, update);
}

app.listen(portNumber) 