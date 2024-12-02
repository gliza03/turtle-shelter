let express = require("express");
let app = express();
let path = require("path");
const port = process.env.PORT || 5000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static('public'));

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

app.get("/", (req, res) => res.render("index"));


app.listen(port, () => console.log("Express App has started and server is listening!"));
