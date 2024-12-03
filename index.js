let express = require("express");
let app = express();
let path = require("path");
const port = process.env.PORT || 5000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static('public'));

app.get("/", (req, res) => res.render("index"));

app.listen(port, () => console.log("Express App has started and server is listening!"));
