
const statusIndicator = document.getElementById("status-indicator");
const statusText = document.getElementById("status-text");
const toggleOnlineButton = document.getElementById("toggle-online");

const totalRequestsElement = document.getElementById("total-requests");
const acceptedRequestsElement = document.getElementById("accepted-requests");
const declinedRequestsElement = document.getElementById("declined-requests");
const missedRequestsElement = document.getElementById("missed-requests");

const requestContainer = document.getElementById("request-container");
const clearButton = document.getElementById("clear-button");

const uberButton = document.getElementById("uber-button");
const rapidoButton = document.getElementById("rapido-button");
const bothButton = document.getElementById("both-button");

let isOnline = true;
let totalRequests = 0;
let acceptedRequests = 0;
let declinedRequests = 0;
let missedRequests = 0;
let nextRequestId = 1;
let buttonsLocked = false;

const activeRequests = new Map();
const MAX_REQUESTS = 4;
const REQUEST_TIMEOUT = 15;

const locations = [
    "Madhapur",
    "Hitech City",
    "Gachibowli",
    "Kondapur",
    "Kukatpally",
    "Jubilee Hills",
    "Banjara Hills",
    "Ameerpet",
    "Miyapur",
    "Financial District",
    "Manikonda",
    "Begumpet",
    "Secunderabad",
    "Mehdipatnam",
    "Dilsukhnagar"
];

const customers = [
    "Rahul Sharma",
    "Arjun Kumar",
    "Priya Reddy",
    "Sneha Rao",
    "Kiran Kumar",
    "Vikram Singh",
    "Ananya Sharma",
    "Rohit Verma",
    "Sanjay Reddy",
    "Neha Patel",
    "Akhil Kumar",
    "Pooja Singh"
];

const uberVehicles = [
    { name: "Uber Go", extra: 0 },
    { name: "Uber Premier", extra: 55 },
    { name: "Uber Auto", extra: 10 },
    { name: "Uber Moto", extra: -15 }
];

const rapidoVehicles = [
    { name: "Rapido Bike", extra: 0 },
    { name: "Rapido Auto", extra: 15 },
    { name: "Rapido Cab", extra: 35 }
];

function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(items) {
    return items[randomNumber(0, items.length - 1)];
}

function randomRating() {
    return (Math.random() * 0.7 + 4.3).toFixed(1);
}

function getDifferentLocation(pickup) {
    let drop;

    do {
        drop = randomItem(locations);
    } while (drop === pickup);

    return drop;
}

function getFare(platform, distance, vehicleExtra) {
    if (platform === "uber") {
        return Math.max(100, Math.round(70 + distance * 22 + vehicleExtra));
    }

    return Math.max(50, Math.round(35 + distance * 13 + vehicleExtra));
}

function updateStats() {
    totalRequestsElement.textContent = totalRequests;
    acceptedRequestsElement.textContent = acceptedRequests;
    declinedRequestsElement.textContent = declinedRequests;
    missedRequestsElement.textContent = missedRequests;
}

function updateEmptyState() {
    if (requestContainer.children.length === 0) {
        requestContainer.innerHTML = `
            <div id="empty-state" class="empty-state">
                <div class="empty-icon">🚕</div>
                <h3>No incoming requests</h3>
                <p>Tap Uber Ride, Rapido Ride, or Both to generate a request.</p>
            </div>
        `;
    }
}

function updateOnlineStatus() {
    statusText.textContent = isOnline ? "Online" : "Offline";
    statusIndicator.style.background = isOnline ? "#20b879" : "#777777";
    toggleOnlineButton.textContent = isOnline ? "Go Offline" : "Go Online";
}

function toggleOnlineStatus() {
    isOnline = !isOnline;
    updateOnlineStatus();
}

function playAlert() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;

        if (!AudioContext) {
            return;
        }

        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.type = "sine";
        oscillator.frequency.value = 750;
        gain.gain.value = 0.12;

        oscillator.start();

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + 0.35
        );

        oscillator.stop(audioContext.currentTime + 0.35);
        oscillator.onended = () => audioContext.close();
    } catch (error) {
        console.log("Alert sound is unavailable.");
    }
}

function notifyDriver() {
    playAlert();

    if ("vibrate" in navigator) {
        navigator.vibrate([150, 80, 150]);
    }
}

function getPendingCount() {
    return [...activeRequests.values()].filter(
        request => request.status === "pending"
    ).length;
}

function removeOldCompletedCards(requiredSlots) {
    const completedCards = [...requestContainer.querySelectorAll(".request-card")]
        .filter(card => {
            const request = activeRequests.get(Number(card.dataset.requestId));
            return !request || request.status !== "pending";
        });

    while (
        requestContainer.querySelectorAll(".request-card").length + requiredSlots > MAX_REQUESTS &&
        completedCards.length > 0
    ) {
        const oldestCard = completedCards.shift();
        oldestCard.remove();
    }
}

function createRideData(platform, sharedDistance = null) {
    const tripDistance = sharedDistance ?? randomNumber(2, 20);
    const pickupDistance = randomNumber(1, 8);
    const pickupETA = Math.max(2, Math.round(pickupDistance * 3 + randomNumber(1, 3)));
    const tripTime = Math.max(5, Math.round(tripDistance * randomNumber(3, 5)));

    const pickup = randomItem(locations);
    const drop = getDifferentLocation(pickup);

    const vehicle = platform === "uber"
        ? randomItem(uberVehicles)
        : randomItem(rapidoVehicles);

    const fare = getFare(platform, tripDistance, vehicle.extra);

    return {
        platform,
        tripDistance,
        pickupDistance,
        pickupETA,
        tripTime,
        pickup,
        drop,
        vehicle: vehicle.name,
        fare,
        customer: randomItem(customers),
        rating: randomRating(),
        payment: randomItem(["Cash", "UPI", "Online"]),
        surge: platform === "uber" && Math.random() < 0.25,
        timeLeft: REQUEST_TIMEOUT,
        status: "pending",
        timer: null
    };
}

function generateRide(platform, sharedDistance = null) {
    if (!isOnline) {
        alert("Please go online before generating requests.");
        return false;
    }

    if (getPendingCount() >= MAX_REQUESTS) {
        alert("The maximum number of pending requests has been reached.");
        return false;
    }

    const ride = createRideData(platform, sharedDistance);
    ride.id = nextRequestId++;

    totalRequests++;
    activeRequests.set(ride.id, ride);

    renderRequest(ride);
    startCountdown(ride);
    updateStats();

    return true;
}

function generateBoth() {
    if (!isOnline) {
        alert("Please go online before generating requests.");
        return;
    }

    if (getPendingCount() + 2 > MAX_REQUESTS) {
        alert("There is not enough space for both requests. Clear or finish a request first.");
        return;
    }

    const sharedDistance = randomNumber(2, 20);

    generateRide("uber", sharedDistance);
    generateRide("rapido", sharedDistance);
}

function renderRequest(request) {
    const isUber = request.platform === "uber";
    const card = document.createElement("article");

    card.className = `request-card ${isUber ? "uber-card" : "rapido-card"}`;
    card.dataset.requestId = request.id;

    card.innerHTML = `
        <div class="request-top">
            <div>
                <div class="request-platform">
                    ${isUber ? "UBER" : "RAPIDO"}
                </div>
                <div class="request-title">New Ride Request</div>
            </div>

            <div class="countdown" id="timer-${request.id}">
                00:15
            </div>
        </div>

        <div class="request-body">

            <div class="fare-row">
                <div>
                    <div class="fare-label">YOUR EARNINGS</div>
                    <div class="fare">₹${request.fare}</div>

                    ${request.surge ? `
                        <div class="surge-tag">SURGE / BOOST</div>
                    ` : ""}
                </div>

                <div class="vehicle-tag">${request.vehicle}</div>
            </div>

            <div class="ride-details">
                <div>
                    <div class="detail-label">DISTANCE TO PICKUP</div>
                    <div class="detail-value">${request.pickupDistance} km</div>
                </div>

                <div>
                    <div class="detail-label">PICKUP ETA</div>
                    <div class="detail-value">${request.pickupETA} min</div>
                </div>

                <div>
                    <div class="detail-label">TRIP DISTANCE</div>
                    <div class="detail-value">${request.tripDistance} km</div>
                </div>

                <div>
                    <div class="detail-label">TRIP TIME</div>
                    <div class="detail-value">${request.tripTime} min</div>
                </div>

                <div>
                    <div class="detail-label">PAYMENT MODE</div>
                    <div class="detail-value">${request.payment}</div>
                </div>
            </div>

            <div class="route">
                <div class="route-line">
                    <span class="route-dot"></span>
                    <span>Pickup: ${request.pickup}</span>
                </div>

                <div class="route-line">
                    <span class="route-dot drop"></span>
                    <span>Drop: ${request.drop}</span>
                </div>
            </div>

            <div class="customer-info">
                Customer: ${request.customer} · ⭐ ${request.rating}
            </div>

            <div class="action-buttons">
                <button class="accept-button" data-action="accepted">
                    ACCEPT
                </button>

                <button class="decline-button" data-action="declined">
                    DECLINE
                </button>
            </div>

            <div class="request-result" id="result-${request.id}"></div>
        </div>
    `;

    card.querySelector('[data-action="accepted"]').addEventListener(
        "click",
        () => handleRequest(request.id, "accepted")
    );

    card.querySelector('[data-action="declined"]').addEventListener(
        "click",
        () => handleRequest(request.id, "declined")
    );

    requestContainer.querySelector("#empty-state")?.remove();
    requestContainer.prepend(card);
}

function startCountdown(request) {
    request.timer = setInterval(() => {
        if (request.status !== "pending") {
            clearInterval(request.timer);
            return;
        }

        request.timeLeft--;

        const timerElement = document.getElementById(`timer-${request.id}`);

        if (timerElement) {
            timerElement.textContent = `00:${String(request.timeLeft).padStart(2, "0")}`;
        }

        if (request.timeLeft <= 0) {
            handleRequest(request.id, "missed");
        }
    }, 1000);
}

function handleRequest(id, status) {
    const request = activeRequests.get(id);

    if (!request || request.status !== "pending") {
        return;
    }

    request.status = status;
    clearInterval(request.timer);

    const card = requestContainer.querySelector(
        `[data-request-id="${id}"]`
    );

    if (!card) {
        activeRequests.delete(id);
        updateStats();
        return;
    }

    const result = document.getElementById(`result-${id}`);
    const buttons = card.querySelectorAll("button");

    buttons.forEach(button => {
        button.disabled = true;
    });

    if (status === "accepted") {
        acceptedRequests++;
        result.textContent = "✓ Ride Accepted";
    } else if (status === "declined") {
        declinedRequests++;
        result.textContent = "✕ Ride Declined";
    } else {
        missedRequests++;
        result.textContent = "⌛ Request Missed";
        card.classList.add("expired");

        setTimeout(() => {
            card.remove();
            updateEmptyState();
        }, 900);
    }

    updateStats();
}

function lockButtons() {
    if (buttonsLocked) {
        return false;
    }

    buttonsLocked = true;

    [uberButton, rapidoButton, bothButton].forEach(button => {
        button.disabled = true;
    });

    setTimeout(() => {
        buttonsLocked = false;

        [uberButton, rapidoButton, bothButton].forEach(button => {
            button.disabled = false;
        });
    }, 500);

    return true;
}

function handleGenerate(platform) {
    if (!lockButtons()) {
        return;
    }

    const requiredSlots = platform === "both" ? 2 : 1;

    if (!isOnline) {
        alert("Please go online before generating requests.");
        return;
    }

    if (getPendingCount() + requiredSlots > MAX_REQUESTS) {
        alert("Maximum pending request limit reached.");
        return;
    }

    removeOldCompletedCards(requiredSlots);

    if (platform === "both") {
        generateBoth();
    } else {
        generateRide(platform);
    }

    notifyDriver();
}

toggleOnlineButton.addEventListener("click", toggleOnlineStatus);

uberButton.addEventListener("click", () => {
    handleGenerate("uber");
});

rapidoButton.addEventListener("click", () => {
    handleGenerate("rapido");
});

bothButton.addEventListener("click", () => {
    handleGenerate("both");
});

clearButton.addEventListener("click", () => {
    activeRequests.forEach(request => {
        clearInterval(request.timer);
    });

    activeRequests.clear();
    requestContainer.innerHTML = "";

    updateEmptyState();
    updateStats();
});

updateOnlineStatus();
updateStats();
