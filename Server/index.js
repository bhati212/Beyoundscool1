const bodyParser = require("body-parser");
const mongoose = require("mongoose");

// const app = express();
const port = process.env.PORT || 5000;


// const customerSchema = new mongoose.Schema({
//     name: String,
//     email: String,
//     phone: String,
//     passport: String,
// });

// const Customer = mongoose.model("Customer", customerSchema);



require("dotenv").config();
const express = require("express");

const app = express();
const cors = require("cors");
require("./db/conn")
const PORT = 5000;
const session = require("express-session");
// const passport = require("passport");
// const OAuth2Strategy = require("passport-google-oauth2").Strategy;
const userdb = require("./model/userSchema")

// const clientid = "268383071382-ahroclullv8e5lcvqvm9u9uviuq7ptbr.apps.googleusercontent.com"
// const clientsecret = "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"


app.use(cors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE",
    credentials: true
}));

app.use(cors());

app.use(express.json());
app.use(bodyParser.json());
// setup session

// app.use(session({
//     secret: "122342qwerasdf",
//     resave: false,
//     saveUninitialized: true
// }))

// app.post("/customers", (req, res) => {
//     const newCustomer = new Customer({
//         name: req.body.name,
//         email: req.body.email,
//         phone: req.body.phone,
//         passport: req.body.passport,
//     });

//     newCustomer.save((err) => {
//         if (err) {
//             console.error(err);
//             res.status(500).send("Error saving customer data.");
//         } else {
//             res.status(200).send("Customer data saved successfully!");
//         }
//     });
// });



// setuppassport
// app.use(passport.initialize());
// app.use(passport.session());

// passport.use(
//     new OAuth2Strategy({
//         clientID: clientid,
//         clientSecret: clientsecret,
//         callbackURL: "/auth/google/callback",
//         scope: ["profile", "email"]
//     },
//         async (accessToken, refreshToken, profile, done) => {
//             try {
//                 let user = await userdb.findOne({ googleId: profile.id });

//                 if (!user) {
//                     user = new userdb({
//                         googleId: profile.id,
//                         displayName: profile.displayName,
//                         email: profile.emails[0].value,
//                         image: profile.photos[0].value
//                     });

//                     await user.save();
//                 }

//                 return done(null, user)

//             } catch (error) {
//                 return done(error, null)
//             }
//         }
//     )
// )

// passport.serializeUser((user, done) => {
//     done(null, user);
// })

// passport.deserializeUser((user, done) => {
//     done(null, user);
// });

// initial google ouath login
// app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// app.get("/auth/google/callback", passport.authenticate("google", {
//     successRedirect: "http://localhost:3000/profile",
//     failureRedirect: "http://localhost:3000/login"
// }))

// app.get("/login/sucess", async (req, res) => {

//     if (req.user) {
//         res.status(200).json({ message: "user Login", user: req.user })
//     } else {
//         res.status(400).json({ message: "Not Authorized" })
//     }
// })

app.get("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err) }
        res.redirect("http://localhost:3000");
    })
})

app.listen(PORT, () => {
    console.log(`server start at port no ${PORT}`)
})


const path = require("path");

const shortid = require("shortid");
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id:"rzp_live_7e4829EGar0omp",
    key_secret: "NeSfAKKzcBBaH7sb3VyA8OWc",
});

app.use(cors());

// Serving company logo
// app.get("/logo.png", (req, res) => {
//     res.sendFile(path.join(__dirname, "logo.png"));
// });

app.post("/razorpay", async (req, res) => {
    // const {recivedamount} = req.body;
    // console.log("recivedamount",recivedamount)
    const payment_capture = 1;
    // const amount = Number(recivedamount*100);
    const currency = "INR";

    const options = {
        amount: Number(req.body.amount * 100),
        currency: "INR",
        receipt: shortid.generate(),
        payment_capture,
    };

    try {
        const response = await razorpay.orders.create(options);
        console.log(response);
        res.json({
            id: response.id,
            currency: response.currency,
            amount: response.amount,
        });
    } catch (error) {
        console.log(error);
    }
});

// app.get("/api/getkey", (req, res) =>
//     res.status(200).json({ key: "rzp_live_7e4829EGar0omp"})
// );



// app.post("/razorpy", async (req, res) => {
//     const payment_capture = 1;
//     const amount = 12000;
//     const currency = "INR";

//     const options = {
//         amount: amount * 100,
//         currency,
//         receipt: shortid.generate(),
//         payment_capture,
//     };

//     try {
//         const response = await razorpay.orders.create(options);
//         console.log(response);
//         res.json({
//             id: response.id,
//             currency: response.currency,
//             amount: response.amount,
//         });
//     } catch (error) {
//         console.log(error);
//     }
// });



// verfication
// app.post("/paymentverfication", async (req, res) => {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
//         req.body;

//     const body = razorpay_order_id + "|" + razorpay_payment_id;

//     const expectedSignature = crypto
//         .createHmac("sha256", "NeSfAKKzcBBaH7sb3VyA8OWc")
//         .update(body.toString())
//         .digest("hex");

//     const isAuthentic = expectedSignature === razorpay_signature;

//     if (isAuthentic) {
//         // Database comes here

//         await Payment.create({
//             razorpay_order_id,
//             razorpay_payment_id,
//             razorpay_signature,
//         });

//         res.redirect(
//             `http://localhost:3000/paymentsuccess?reference=${razorpay_payment_id}`
//         );
//     } else {
//         res.status(400).json({
//             success: false,
//         });
//     }

// })



// Middleware
app.use(bodyParser.json()); // Parse JSON requests



// Define a schema for your data (example: user data)
// const userSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     email: { type: String, required: true },
//     // Add other fields as needed
// });

// const Client = mongoose.model('Client', userSchema);

// Create an API endpoint to save user data
// app.post('/api/save-user', async (req, res) => {
//     try {
//         const { name, email } = req.body;
//         const newUser = new Client({ name, email });
//         await newUser.save();
//         res.status(201).json({ message: 'User saved successfully!' });
//     } catch (error) {
//         console.error('Error saving user:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

















// profile model 


const ProfileSchema = new mongoose.Schema({
    name: String,
    mobileNumber: String,
    fathersMobileNumber: String,
    email: String,
    city: String,
    school: String,
    class: String
});

const Profile = mongoose.model('Profile', ProfileSchema);



// profile endpoints
app.post('/api/profiles', async (req, res) => {
    try {
        console.log("profile body", req.body);

        const profile = new Profile(req.body);
        if (profile) {
            await profile.save();
            console.log("profile saved")
            res.status(201).send(profile);
        }
        else{
            return res.status(402).json("Profile not created");
        }
    } catch (error) {
        res.status(400).send(error);
    }
});

app.get('/api/getProfile', async(req, res) => {
    
    try{
        const { email } = req.query;
        console.log("email", email);
       
        if (!email) {
            return res.status(400).json("Email is required");
        }

        const profile = await Profile.findOne({ email });

        if (!profile) {
            return res.status(404).json("Profile not found");
        }

        res.status(200).json(profile);
    }
    catch(error){
        console.error("Error retrieving profile:", error);
        res.status(500).json("Internal Server Error");
    }
})



// payment success endpoint
const mailSender = require("./utils/mailSender");
const { paymentTemplate } = require("./mails/paymentTemplate");

app.post(`/onsuccessfullpayement`, async (req, res) => {

    try {
        const { email, className, subject } = req.body;

        console.log('Email:', email);
        console.log('Class:', className);
        console.log('Subject:', subject);

        const emailInfo = await mailSender(email, `BeyondScool : Payment Verifcation`, paymentTemplate(subject, className))

        if (emailInfo) {
            res.status(200).json({ message: 'Mail sent successful', data: req.body });
        }
        else {
            res.status(403).json({ message: 'Mial not sent successful', data: req.body });
        }
    }
    catch (error) {
        console.log("Server Error");
    }
})
