const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5000;

const MONGODB_URI =
  process.env.MONGODB_URI;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


/* =========================
   DATABASE MODELS
========================= */

const movieSchema = new mongoose.Schema({
    title: String,
    genre: String,
    duration: String,
    language: String,
    rating: String,
    description: String,
    poster: String
});

const showSchema = new mongoose.Schema({
    movieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Movie"
    },

    cinema: String,
    screen: String,
    date: String,
    time: String
});

const bookingSchema = new mongoose.Schema({
    bookingCode: {
        type: String,
        unique: true
    },

    customerName: String,
    email: String,
    phone: String,

    movieId: mongoose.Schema.Types.ObjectId,
    showId: mongoose.Schema.Types.ObjectId,

    movieTitle: String,
    cinema: String,
    screen: String,

    date: String,
    time: String,

    seats: [String],

    ticketTotal: Number,

    snacks: [
        {
            name: String,
            qty: Number,
            price: Number
        }
    ],

    snackSubtotal: Number,
    snackDiscount: Number,
    grandTotal: Number,

    paymentStatus: {
        type: String,
        default: "PENDING"
    },

    checkedIn: {
        type: Boolean,
        default: false
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});


const Movie = mongoose.model("Movie", movieSchema);
const Show = mongoose.model("Show", showSchema);
const Booking = mongoose.model("Booking", bookingSchema);


/* =========================
   SEAT PRICING
========================= */

function getSeatPrice(seat) {

    const rowNumber =
        seat.charCodeAt(0) - 64;

    return 50 + ((rowNumber - 1) * 10);
}


/*
Row A = ₹50
Row B = ₹60
Row C = ₹70

...

Row O = ₹190
*/


/* =========================
   GENERATE SEATS
========================= */

function generateSeats() {

    const rows =
        "ABCDEFGHIJKLMNO".split("");

    const seats = [];

    rows.forEach(row => {

        for (let number = 1; number <= 10; number++) {

            seats.push(`${row}${number}`);

        }

    });

    return seats;
}


/* =========================
   DEMO OTP
========================= */

const otpStore = new Map();

function generateOTP() {

    return String(
        Math.floor(
            1000 + Math.random() * 9000
        )
    );
}


/* =========================
   MOVIES API
========================= */

app.get("/api/movies", async (req, res) => {

    const movies =
        await Movie.find();

    res.json(movies);

});


/* =========================
   SHOWS API
========================= */

app.get("/api/shows", async (req, res) => {

    const shows =
        await Show.find()
            .populate("movieId");

    res.json(shows);

});


/* =========================
   SEATS API
========================= */

app.get(
    "/api/shows/:id/seats",
    async (req, res) => {

        const showId =
            req.params.id;

        const bookings =
            await Booking.find({
                showId: showId,
                paymentStatus: "PAID"
            });

        const bookedSeats = [];

        bookings.forEach(booking => {

            booking.seats.forEach(seat => {

                bookedSeats.push(seat);

            });

        });


        const seats =
            generateSeats().map(seat => {

                return {

                    id: seat,

                    price:
                        getSeatPrice(seat),

                    status:
                        bookedSeats.includes(seat)
                            ? "booked"
                            : "available"

                };

            });


        res.json(seats);

    }
);


/* =========================
   LOGIN OTP
========================= */

app.post(
    "/api/auth/send-otp",
    (req, res) => {

        const {
            destination,
            method
        } = req.body;


        if (!destination) {

            return res.status(400)
                .json({
                    message:
                        "Enter mobile number or Gmail"
                });

        }


        const otp =
            generateOTP();


        otpStore.set(
            destination,
            {
                otp: otp,
                expires:
                    Date.now() + 5 * 60 * 1000
            }
        );


        console.log(
            `DEMO OTP for ${destination}: ${otp}`
        );


        res.json({

            success: true,

            message:
                "OTP generated",

            demoCode: otp

        });

    }
);


/* =========================
   VERIFY OTP
========================= */

app.post(
    "/api/auth/verify-otp",
    (req, res) => {

        const {
            destination,
            code
        } = req.body;


        const saved =
            otpStore.get(destination);


        if (!saved) {

            return res.status(400)
                .json({
                    message:
                        "OTP not found"
                });

        }


        if (
            saved.expires <
            Date.now()
        ) {

            return res.status(400)
                .json({
                    message:
                        "OTP expired"
                });

        }


        if (
            saved.otp !==
            String(code)
        ) {

            return res.status(400)
                .json({
                    message:
                        "Wrong OTP"
                });

        }


        otpStore.delete(destination);


        res.json({

            success: true,

            message:
                "Login successful"

        });

    }
);


/* =========================
   CREATE BOOKING
========================= */

app.post(
    "/api/bookings/create",
    async (req, res) => {

        try {

            const {

                customerName,
                email,
                phone,

                showId,

                seats,

                snacks

            } = req.body;


            if (
                !customerName ||
                !showId ||
                !seats ||
                seats.length === 0
            ) {

                return res.status(400)
                    .json({
                        message:
                            "Please complete booking details"
                    });

            }


            const show =
                await Show.findById(showId)
                    .populate("movieId");


            if (!show) {

                return res.status(404)
                    .json({
                        message:
                            "Show not found"
                    });

            }


            /*
            Check whether selected
            seats are already booked
            */

            const existingBookings =
                await Booking.find({
                    showId: showId,
                    paymentStatus: "PAID"
                });


            const bookedSeats = [];


            existingBookings.forEach(
                booking => {

                    booking.seats.forEach(
                        seat => {

                            bookedSeats.push(
                                seat
                            );

                        }
                    );

                }
            );


            const duplicateSeat =
                seats.find(seat =>
                    bookedSeats.includes(seat)
                );


            if (duplicateSeat) {

                return res.status(409)
                    .json({

                        message:
                            `${duplicateSeat} is already booked`

                    });

            }


            /* =========================
               TICKET PRICE
            ========================= */

            let ticketTotal = 0;


            seats.forEach(seat => {

                ticketTotal +=
                    getSeatPrice(seat);

            });


            /* =========================
               SNACK PRICE
            ========================= */

            const snackList =
                snacks || [];


            let snackSubtotal = 0;


            snackList.forEach(snack => {

                snackSubtotal +=
                    Number(snack.price) *
                    Number(snack.qty);

            });


            /*
            5% snack discount
            */

            const snackDiscount =
                snackSubtotal > 0
                    ? snackSubtotal * 0.05
                    : 0;


            const grandTotal =
                ticketTotal +
                snackSubtotal -
                snackDiscount;


            /* =========================
               BOOKING CODE
            ========================= */

            const bookingCode =
                "CB-" +
                crypto
                    .randomBytes(5)
                    .toString("hex")
                    .toUpperCase();


            /* =========================
               CREATE BOOKING
            ========================= */

            const booking =
                await Booking.create({

                    bookingCode,

                    customerName,

                    email,

                    phone,

                    movieId:
                        show.movieId._id,

                    showId,

                    movieTitle:
                        show.movieId.title,

                    cinema:
                        show.cinema,

                    screen:
                        show.screen,

                    date:
                        show.date,

                    time:
                        show.time,

                    seats,

                    ticketTotal,

                    snacks:
                        snackList,

                    snackSubtotal,

                    snackDiscount,

                    grandTotal,

                    /*
                    DEMO PAYMENT
                    */

                    paymentStatus:
                        "PAID"

                });


            /*
            Tell every connected
            browser that seats changed.
            */

            io.to(String(showId))
                .emit("seats-updated");


            res.json({

                success: true,

                message:
                    "Demo payment successful",

                booking

            });


        } catch (error) {

            console.error(error);

            res.status(500)
                .json({

                    message:
                        "Booking failed"

                });

        }

    }
);


/* =========================
   GENERATE QR TICKET
========================= */

app.get(
    "/api/bookings/:code",
    async (req, res) => {

        const booking =
            await Booking.findOne({
                bookingCode:
                    req.params.code
            });


        if (!booking) {

            return res.status(404)
                .json({
                    message:
                        "Booking not found"
                });

        }


        const qrData =
            JSON.stringify({

                bookingCode:
                    booking.bookingCode,

                movie:
                    booking.movieTitle,

                date:
                    booking.date,

                time:
                    booking.time,

                seats:
                    booking.seats

            });


        const qr =
            await QRCode.toDataURL(
                qrData
            );


        res.json({

            booking,

            qr

        });

    }
);


/* =========================
   ADMIN BOOKINGS
========================= */

app.get(
    "/api/admin/bookings",
    async (req, res) => {

        const bookings =
            await Booking.find()
                .sort({
                    createdAt: -1
                });


        const revenue =
            bookings.reduce(
                (total, booking) => {

                    return total +
                        booking.grandTotal;

                },
                0
            );


        res.json({

            bookings,

            revenue,

            count:
                bookings.length

        });

    }
);


/* =========================
   STAFF CHECK-IN
========================= */

app.post(
    "/api/checkin",
    async (req, res) => {

        const {
            bookingCode
        } = req.body;


        const booking =
            await Booking.findOne({
                bookingCode
            });


        if (!booking) {

            return res.status(404)
                .json({
                    message:
                        "Ticket not found"
                });

        }


        if (booking.checkedIn) {

            return res.status(409)
                .json({
                    message:
                        "Ticket already used"
                });

        }


        booking.checkedIn = true;

        await booking.save();


        res.json({

            success: true,

            message:
                "Ticket verified successfully"

        });

    }
);


/* =========================
   SOCKET.IO
========================= */

io.on(
    "connection",
    socket => {

        socket.on(
            "join-show",
            showId => {

                socket.join(
                    String(showId)
                );

            }
        );

    }
);


/* =========================
   DEFAULT PAGE
========================= */

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/* =========================
   CONNECT MONGODB
========================= */

mongoose.connect(
    MONGODB_URI
)
.then(async () => {

    console.log(
        "MongoDB connected successfully"
    );


    /*
    Add movies automatically
    if database is empty.
    */

    const movieCount =
        await Movie.countDocuments();


    if (movieCount === 0) {

        const movies =
            await Movie.insertMany([

                {
                    title:
                        "Neon Horizon",

                    genre:
                        "Sci-Fi • Action",

                    duration:
                        "2h 18m",

                    language:
                        "English",

                    rating:
                        "8.7",

                    description:
                        "A futuristic journey through a city where memories can be bought and sold.",

                    poster:
                        "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80"
                },


                {
                    title:
                        "Midnight Express",

                    genre:
                        "Thriller • Mystery",

                    duration:
                        "2h 04m",

                    language:
                        "Hindi",

                    rating:
                        "8.3",

                    description:
                        "A mysterious journey where nobody is who they seem.",

                    poster:
                        "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80"
                },


                {
                    title:
                        "Monsoon Letters",

                    genre:
                        "Drama • Romance",

                    duration:
                        "2h 11m",

                    language:
                        "Hindi",

                    rating:
                        "8.1",

                    description:
                        "Two old friends reconnect through a box of letters.",

                    poster:
                        "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=80"
                }

            ]);


        const today =
            new Date()
                .toISOString()
                .split("T")[0];


        for (
            const movie of movies
        ) {

            await Show.insertMany([

                {
                    movieId:
                        movie._id,

                    cinema:
                        "CineBook Central",

                    screen:
                        "Screen 1",

                    date:
                        today,

                    time:
                        "10:30 AM"
                },


                {
                    movieId:
                        movie._id,

                    cinema:
                        "CineBook Central",

                    screen:
                        "Screen 2",

                    date:
                        today,

                    time:
                        "2:30 PM"
                },


                {
                    movieId:
                        movie._id,

                    cinema:
                        "CineBook Central",

                    screen:
                        "Screen 1",

                    date:
                        today,

                    time:
                        "6:30 PM"
                },


                {
                    movieId:
                        movie._id,

                    cinema:
                        "CineBook Central",

                    screen:
                        "Screen 3",

                    date:
                        today,

                    time:
                        "9:30 PM"
                }

            ]);

        }

        console.log(
            "Demo movies created"
        );

    }


    server.listen(
        PORT,
        () => {

            console.log(
                `CineBook running at http://localhost:${PORT}`
            );

        }
    );

})
.catch(error => {

    console.error(
        "MongoDB connection error:",
        error.message
    );

});