const socket = io();

let movies = [];

let shows = [];

let currentShow = null;

let selectedSeats = new Set();

let loginMethod = "phone";


const $ = id =>
    document.querySelector(id);


/* =========================
   LOAD DATA
========================= */

async function loadData() {

    movies =
        await fetch("/api/movies")
            .then(response =>
                response.json()
            );


    shows =
        await fetch("/api/shows")
            .then(response =>
                response.json()
            );


    displayMovies();

    createMiniSeats();

}


loadData();



/* =========================
   MOVIES
========================= */

function displayMovies() {

    const movieGrid =
        $("#movieGrid");


    movieGrid.innerHTML =
        movies.map(movie => {

            const movieShows =
                shows.filter(show =>
                    String(
                        show.movieId._id
                    ) ===
                    String(movie._id)
                );


            return `

                <div class="movie">

                    <div
                        class="poster"
                        style="
                            background-image:
                            url('${movie.poster}')
                        "
                    ></div>


                    <div class="movie-info">

                        <p class="eyebrow">
                            ${movie.genre}
                        </p>

                        <h3>
                            ${movie.title}
                        </h3>

                        <p>
                            ${movie.duration}
                            •
                            ${movie.language}
                            <br>
                            ⭐ ${movie.rating}
                        </p>


                        <div class="showtimes">

                            ${
                                movieShows.map(
                                    show => `

                                    <button
                                        class="showtime"
                                        onclick="
                                            openBooking('${show._id}')
                                        "
                                    >

                                        ${show.time}

                                    </button>

                                    `
                                ).join("")
                            }

                        </div>

                    </div>

                </div>

            `;

        }).join("");

}



/* =========================
   MINI SEATS
========================= */

function createMiniSeats() {

    $("#miniSeats").innerHTML =
        Array.from(
            { length: 70 },
            () => `<span></span>`
        ).join("");

}



/* =========================
   OPEN BOOKING
========================= */

async function openBooking(showId) {

    currentShow =
        shows.find(
            show =>
                String(show._id) ===
                String(showId)
        );


    selectedSeats.clear();


    $("#bookingMovie")
        .textContent =
        currentShow.movieId.title;


    $("#bookingShow")
        .textContent =
        `${currentShow.cinema}
        •
        ${currentShow.screen}
        •
        ${currentShow.date}
        •
        ${currentShow.time}`;


    socket.emit(
        "join-show",
        showId
    );


    await loadSeats();


    $("#bookingModal")
        .classList
        .remove("hidden");

}



/* =========================
   LOAD SEATS
========================= */

async function loadSeats() {

    const response =
        await fetch(
            `/api/shows/${currentShow._id}/seats`
        );


    const seats =
        await response.json();


    const rows = {};


    seats.forEach(seat => {

        const row =
            seat.id.charAt(0);


        if (!rows[row]) {

            rows[row] = [];

        }


        rows[row].push(seat);

    });


    $("#seatMap").innerHTML =
        Object.entries(rows)
            .map(
                ([row, seats]) => `

                    <div class="seat-row">

                        <span
                            class="row-label"
                        >
                            ${row}
                        </span>


                        ${
                            seats.map(
                                seat => `

                                <button

                                    class="
                                        seat
                                        ${seat.status}
                                        ${
                                            selectedSeats
                                                .has(seat.id)
                                                ? "selected"
                                                : ""
                                        }
                                    "

                                    ${
                                        seat.status ===
                                        "booked"
                                            ? "disabled"
                                            : ""
                                    }

                                    onclick="
                                        selectSeat(
                                            '${seat.id}'
                                        )
                                    "

                                >

                                    ${seat.id.substring(1)}

                                </button>

                                `
                            ).join("")
                        }

                    </div>

                `
            )
            .join("");


    updateSummary();

}



/* =========================
   SELECT SEAT
========================= */

function selectSeat(seat) {

    if (
        selectedSeats.has(seat)
    ) {

        selectedSeats.delete(
            seat
        );

    } else {

        selectedSeats.add(
            seat
        );

    }


    loadSeats();

}



/* =========================
   PRICE
========================= */

function seatPrice(seat) {

    const row =
        seat.charCodeAt(0) -
        64;


    return 50 +
        ((row - 1) * 10);

}



/* =========================
   SNACKS
========================= */

function getSnacks() {

    const checked =
        document.querySelectorAll(
            ".snacks input:checked"
        );


    return [...checked]
        .map(item => ({

            name:
                item.value,

            qty:
                1,

            price:
                Number(
                    item.dataset.price
                )

        }));

}



/* =========================
   SUMMARY
========================= */

function updateSummary() {

    let ticketTotal = 0;


    selectedSeats.forEach(
        seat => {

            ticketTotal +=
                seatPrice(seat);

        }
    );


    const snacks =
        getSnacks();


    let snackTotal = 0;


    snacks.forEach(snack => {

        snackTotal +=
            snack.price *
            snack.qty;

    });


    const discount =
        snackTotal *
        0.05;


    const total =
        ticketTotal +
        snackTotal -
        discount;


    $("#sumSeats")
        .textContent =
        selectedSeats.size
            ? [...selectedSeats]
                .join(", ")
            : "—";


    $("#sumTickets")
        .textContent =
        "₹" +
        ticketTotal;


    $("#sumSnacks")
        .textContent =
        "₹" +
        snackTotal;


    $("#sumDiscount")
        .textContent =
        "−₹" +
        discount.toFixed(2);


    $("#sumTotal")
        .textContent =
        "₹" +
        total.toFixed(2);


    $("#payBtn")
        .textContent =
        `Pay ₹${total.toFixed(2)} — Demo`;

}



/* =========================
   SNACK EVENT
========================= */

document
    .querySelectorAll(
        ".snacks input"
    )
    .forEach(input => {

        input.addEventListener(
            "change",
            updateSummary
        );

    });



/* =========================
   CHECKOUT
========================= */

$("#checkoutBtn")
    .onclick = () => {

        if (
            selectedSeats.size === 0
        ) {

            alert(
                "Please select at least one seat."
            );

            return;

        }


        $("#customerModal")
            .classList
            .remove("hidden");


        updateSummary();

    };



/* =========================
   DEMO PAYMENT
========================= */

$("#payBtn")
    .onclick = async () => {

        const name =
            $("#customerName")
                .value
                .trim();


        if (!name) {

            alert(
                "Please enter your name."
            );

            return;

        }


        const snacks =
            getSnacks();


        const response =
            await fetch(
                "/api/bookings/create",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            customerName:
                                name,

                            email:
                                $("#customerEmail")
                                    .value
                                    .trim(),

                            phone:
                                $("#customerPhone")
                                    .value
                                    .trim(),

                            showId:
                                currentShow._id,

                            seats:
                                [...selectedSeats],

                            snacks:
                                snacks

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message
            );

            return;

        }


        closeModals();


        showTicket(
            data.booking
        );

    };



/* =========================
   SHOW TICKET
========================= */

async function showTicket(
    booking
) {

    const response =
        await fetch(
            `/api/bookings/${booking.bookingCode}`
        );


    const data =
        await response.json();


    $("#ticketContent")
        .innerHTML = `

            <div class="ticket-card">

                <h2>
                    ${booking.movieTitle}
                </h2>


                <p>
                    ${booking.cinema}
                </p>


                <p>
                    ${booking.screen}
                </p>


                <p>
                    ${booking.date}
                    •
                    ${booking.time}
                </p>


                <p>
                    <b>
                        Seats:
                    </b>

                    ${booking.seats.join(", ")}
                </p>


                <p>
                    <b>
                        Total:
                    </b>

                    ₹${booking.grandTotal}
                </p>


                <p>
                    <b>
                        Ticket:
                    </b>

                    ${booking.bookingCode}
                </p>


                <img
                    src="${data.qr}"
                    alt="Booking QR"
                >


                <p>
                    Demo payment confirmed.
                </p>

            </div>

        `;


    $("#ticketModal")
        .classList
        .remove("hidden");

}



/* =========================
   LOGIN
========================= */

$("#loginBtn")
    .onclick = () => {

        $("#loginModal")
            .classList
            .remove("hidden");

    };



/* =========================
   LOGIN METHOD
========================= */

document
    .querySelectorAll(
        ".tabs button"
    )
    .forEach(button => {

        button.onclick = () => {

            document
                .querySelectorAll(
                    ".tabs button"
                )
                .forEach(
                    btn =>
                        btn.classList
                            .remove("active")
                );


            button.classList
                .add("active");


            loginMethod =
                button.dataset.method;


            $("#destination")
                .placeholder =
                loginMethod === "phone"
                    ? "Enter mobile number"
                    : "Enter Gmail";

        };

    });



/* =========================
   SEND OTP
========================= */

$("#sendOtp")
    .onclick = async () => {

        const destination =
            $("#destination")
                .value
                .trim();


        if (!destination) {

            alert(
                "Enter mobile number or Gmail."
            );

            return;

        }


        const response =
            await fetch(
                "/api/auth/send-otp",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            destination,

                            method:
                                loginMethod

                        })

                }
            );


        const data =
            await response.json();


        $("#otpArea")
            .classList
            .remove("hidden");


        $("#otpHint")
            .textContent =
            `Demo OTP:
             ${data.demoCode}`;

    };



/* =========================
   VERIFY OTP
========================= */

$("#verifyOtp")
    .onclick = async () => {

        const destination =
            $("#destination")
                .value
                .trim();


        const code =
            $("#otp")
                .value
                .trim();


        const response =
            await fetch(
                "/api/auth/verify-otp",
                {

                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            destination,

                            code

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message
            );

            return;

        }


        closeModals();


        $("#loginBtn")
            .textContent =
            "Verified ✓";


        alert(
            "Login successful!"
        );

    };



/* =========================
   SOCKET UPDATE
========================= */

socket.on(
    "seats-updated",
    () => {

        if (
            currentShow &&
            !$("#bookingModal")
                .classList
                .contains("hidden")
        ) {

            loadSeats();

        }

    }
);



/* =========================
   CLOSE MODALS
========================= */

document
    .querySelectorAll(
        "[data-close]"
    )
    .forEach(button => {

        button.onclick =
            closeModals;

    });


function closeModals() {

    document
        .querySelectorAll(
            ".modal"
        )
        .forEach(modal => {

            modal.classList
                .add("hidden");

        });

}