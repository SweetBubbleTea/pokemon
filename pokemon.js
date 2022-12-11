const fs = require('fs'); 
const http = require("http"); 
const path = require("path"); 
const express = require("express"); 
const bodyParser = require("body-parser"); 
const app = express();  
const portNumber = 5001; 
let user; 

process.stdin.setEncoding("utf8"); 
app.set("views", path.resolve(__dirname, "templates")); 
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));

require("dotenv").config({ path: path.resolve(__dirname, 'config/.env') })  

const userName = process.env.MONGO_DB_USERNAME; 
const password = process.env.MONGO_DB_PASSWORD; 
const db = process.env.MONGO_DB_NAME; 
const collection = process.env.MONGO_COLLECTION;

const databaseAndCollection = {db: db, collection: collection}; 
	 
const { MongoClient, ServerApiVersion } = require('mongodb'); 
const res = require('express/lib/response');
const { response } = require('express');

const uri = "mongodb+srv://azhao21:CMSC335stuff@cluster0.f1xttpg.mongodb.net/?retryWrites=true&w=majority" 
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

app.get("/", (request, response) => {
    response.render("index")
})

app.get("/registration", async (request, response) => {

    try {
        await client.connect(); 

        const {name, age, email, username, password} = request.query 
        if (name && age && email && username && password) {
            let result = await lookUpByUsername(client, databaseAndCollection, username)
            if (result) {
                const variables = {
                    operation: "Error", 
                    msg: "Username already exists", 
                    url: "http://localhost:5001/registration" 
                }
                response.render("confirmationMsg", variables)
            } else {
                let app = {name: name, age: age, email: email, username: username, password: password, team: []}
                await insertApp(client, databaseAndCollection, app)
                response.render("signup")
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
 
app.get("/login", (request, response) => {

    async function main() {
        try {
            await client.connect();
            let result =  await lookUpByUsername(client, databaseAndCollection, request.query.username);
            let back = "http://localhost:5001/"
            if (result) {
                if (result.password == request.query.password) {
                    const variables = {
                        name: result.name, 
                        team: result.team
                    }
                    user = result.username
                    response.render("login", variables)
                } else {
                    const variables = {
                        operation: "Error",
                        msg: "Incorrect password", 
                        url: back
                    }
                    response.render("confirmationMsg", variables)
                }
            } else {
                const variables = {
                    operation: "Error",
                    msg: "User does not exist", 
                    url: back
                }
                response.render("confirmationMsg", variables)
            }
        
        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
    }

    main().catch(console.error())
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
                        const variables = {
                            operation: "Error",
                            msg: pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is not a Pokemon!", 
                            url: back
                        }
                        response.render("confirmationMsg", variables)
                    } else {
                        await insertPokemon(client, databaseAndCollection, user, newValues)
                        const variables = {
                            operation: "Success",
                            msg: pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " added successfully!", 
                            url: back
                        }
                        response.render("confirmationMsg", variables)
                    } 
                } else {
                    const variables = {
                        operation: "Error",
                        msg: pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is already in your team!", 
                        url: back
                    }
                    response.render("confirmationMsg", variables)
                }
            } else {
                const variables = {
                    operation: "Error", 
                    msg: "You have no more empty spaces to add Pokemon!",
                    url: back
                }
                response.render("confirmationMsg", variables) 
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
                    const variables = {
                        operation: "Success",
                        msg: pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " removed successfully!", 
                        url: back
                    }
                    response.render("confirmationMsg", variables)
                } else {
                    const variables = {
                        operation: "Error",
                        msg: pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is not in your team!", 
                        url: back
                    }
                    response.render("confirmationMsg", variables)
                }
            } else {
                const variables = {
                    operation: "Error", 
                    msg: "You don't have any Pokemon in your team!", 
                    url: back
                }
                response.render("confirmationMsg", variables) 
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
                msg: result.team, 
                url: back
            }
            response.render("confirmationMsg", variables) 
        } else {
            const variables = {
                operation: "Error", 
                msg: "User not found!", 
                url: back
            }
            response.render("confirmationMsg", variables) 
        }
    }
})

app.post("/isAPokemon", async (request, response) => {
    if (request.body.query) {
        pokemon = request.body.query.toLowerCase() 
        let url = "https://pokeapi.co/api/v2/pokemon/" + pokemon
        await client.connect();
        let signIn = await lookUpByUsername(client, databaseAndCollection, user) 
        let back = "http://localhost:5001/login?username=" + signIn.username + "&password=" + signIn.password
        let status = await fetch(url)
        
        if (status.status == 404 || status.statusText == "Not Found") {
            const variables = {
                operation: "Error",
                msg: pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is not a Pokemon!", 
                url: back
            }
            response.render("confirmationMsg", variables)
        } else {
            const variables = {
                operation: "Success",
                msg: pokemon.charAt(0).toUpperCase() + pokemon.slice(1) + " is a Pokemon!", 
                url: back
            }
            response.render("confirmationMsg", variables)
        }
    }
})

 

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