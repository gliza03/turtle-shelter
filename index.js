let express = require("express");
let app = express();
let path = require("path");
const port = process.env.PORT || 5000;

const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME,
        user: process.env.RDS_USERNAME,
        password: process.env.RDS_PASSWORD,
        database: process.env.RDS_DB_NAME,
        port: process.env.RDS_PORT,
        ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false
    }
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static('public'));

// Original routes
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));

// New routes for additional pages
app.get("/about", (req, res) => res.render("about"));
app.get("/impact", (req, res) => res.render("impact"));
app.get("/involved", (req, res) => res.render("involved"));
app.get("/jen", (req, res) => res.render("jen"));

app.listen(port, () => console.log("Express App has started and server is listening!"));