let express = require("express");
let app = express();
let path = require("path");
const port = process.env.PORT || 5500;

const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "awseb-e-p3hejwztvb-stack-awsebrdsdatabase-9dd6rktoa0gk.cz6qkie2wm9u.us-east-1.rds.amazonaws.com",
        user: process.env.RDS_USERNAME || "turtles",
        password: process.env.RDS_PASSWORD || "Turtle414",
        database: process.env.RDS_DB_NAME || "ebdb",
        port: process.env.RDS_PORT || "5432",
        ssl: { rejectUnauthorized: false }
    }
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Update your existing static middleware if needed
app.use(express.static('public'));
app.use('/js', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// Original routes
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));

// New routes for additional pages
app.get("/about", (req, res) => res.render("about"));
app.get("/eventrequest", (req, res) => res.render("eventrequest"));
app.get("/admin", (req, res) => res.render("admin"));
app.get("/volunteer", (req, res) => res.render("volunteer"));
app.get("/donation", (req, res) => res.render("donation"));
app.get("/impact", (req, res) => res.render("impact"));
app.get("/involved", (req, res) => res.render("involved"));
app.get("/jen", (req, res) => res.render("jen"));


app.post('/submit-volunteer', async (req, res) => {
    const {
        volunteer_first_name,
        volunteer_last_name,
        volunteer_email,
        volunteer_phone_num,
        volunteer_preferred_communication,
        volunteer_gender,
        volunteer_street,
        volunteer_city,
        volunteer_state,
        volunteer_zip_code,
        volunteer_sewing_level,
        volunteer_leadership,
        volunteer_ref_source,
        availability = [], // Expecting an array of { date, start, end } objects
    } = req.body;

    knex.transaction(async (trx) => {
        try {
            // Insert into 'volunteers' table
            const [result] = await trx('volunteers')
                .insert({
                    volunteer_first_name,
                    volunteer_last_name,
                    volunteer_email: volunteer_email.toLowerCase(),
                    volunteer_phone_num,
                    volunteer_preferred_communication,
                    volunteer_gender,
                    volunteer_street,
                    volunteer_city,
                    volunteer_state,
                    volunteer_zip_code,
                    volunteer_sewing_level,
                    volunteer_leadership,
                    volunteer_ref_source,
                })
                .returning('volunteer_id');

            const volunteer_id = result.volunteer_id || result;

            // Validate and insert availability rows
            const availabilityRows = availability
                .filter(({ start, end }) => calculateHours(start, end) !== null)
                .map(({ date, start, end }) => ({
                    volunteer_id,
                    volunteer_date_available: date,
                    volunteer_start_availability: start,
                    volunteer_end_availability: end,
                    volunteer_hours_available: calculateHours(start, end),
                }));

            if (availabilityRows.length > 0) {
                await trx('volunteer_availability').insert(availabilityRows);
            }

            // Commit transaction
            await trx.commit();
            res.redirect('/thank-you');
        } catch (error) {
            await trx.rollback();
            console.error('Error saving volunteer data:', error);
            res.status(500).send('Internal Server Error');
        }
    });
});

// Helper function to calculate hours
function calculateHours(start, end) {
    const startTime = new Date(`1970-01-01T${start}:00Z`);
    const endTime = new Date(`1970-01-01T${end}:00Z`);
    const difference = Math.floor((endTime - startTime) / (1000 * 60 * 60)); // Convert ms to hours
    return difference > 0 ? difference : null; // Ensure non-negative
}




// THIS IS FOR STRIPE TESTING:
//
//
//
const bodyParser = require('body-parser');
const stripe = require('stripe')('sk_test_your_secret_key'); // Replace with your secret key


// Middleware
app.use(bodyParser.json());

// Your existing routes
app.get('/', (req, res) => {
    res.send('Welcome to Turtle Shelter Project Backend!');
});

// Add Stripe Payment Intent Route
app.post('/create-payment-intent', async (req, res) => {
    const { amount, currency } = req.body;

    try {
        // Create a PaymentIntent with the specified amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount, // Amount in smallest currency unit (e.g., cents for USD)
            currency,
        });

        // Send the client secret to the frontend
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});
//
//
//
// END STRIPE TEST CODE

app.get('/test-db', async (req, res) => {
    try {
        // Test query to check database connection
        const result = await knex.raw('SELECT 1+1 AS result');
        console.log('Database connected:', result);
        res.status(200).json({ success: true, message: 'Database connected successfully!', result });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ success: false, message: 'Failed to connect to the database', error: err.message });
    }
});


app.listen(port, () => console.log("Express App has started and server is listening!"));