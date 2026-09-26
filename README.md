# 🏎️ Neon Kart Chaos

![Neon Kart Chaos](https://neon-kart-chaos-ajsmlvr5z-srisanjai01s-projects.vercel.app/favicon.ico) <!-- You can replace this with a real screenshot! -->

**Neon Kart Chaos** is a fast-paced, fully-playable multiplayer 3D kart racing game built for the browser. 

The coolest feature? **You use your mobile phone as the controller!**

When you open the game on a desktop or laptop, a unique QR code is generated. Scan it with your phone's camera, and your phone instantly transforms into a dedicated digital steering wheel/gamepad—while the heavy 3D game graphics render smoothly on the big screen.

## ✨ Features
- **Mobile Gamepad Controller:** No need for a physical controller or crowded keyboards. Your smartphone connects instantly via WebSockets and acts as your steering wheel and item trigger.
- **Real-Time Multiplayer:** Race against friends in the same room or across the internet with near-zero latency, powered by Ably Realtime.
- **3D Graphics in the Browser:** Built using `three.js` to render a sleek, neon-style aesthetic without requiring downloads or plugins.
- **Custom Kart Physics:** Tuned drifting, speed boosting, and collision physics that mimic classic kart racers.
- **Mario Kart-Style Items:** Pick up item boxes to launch missiles, drop mines, or deploy a warp speed boost.

## 🛠️ Tech Stack
- **Frontend Framework:** Vite & Vanilla TypeScript
- **3D Rendering Engine:** Three.js
- **Real-Time Networking:** Ably WebSockets
- **Deployment:** Vercel

## 🧠 The Story Behind This Game (My AI Prompting Side-Quest)
I actually come from an **Electronics and Communication Engineering (ECE)** and **PCB Design** background. I wanted to see what was possible with modern AI, so I took up "prompt engineering" as a side quest.

This entire game—from the real-time websocket networking, the custom physics engine, the 3D graphics rendering, all the way to the dual-device mobile controller architecture—was built by heavily leveraging AI prompting and iterative debugging. It stands as a real-world example of how powerful AI can be in translating complex ideas into functional software, even if your primary domain is hardware!

## 🚀 How to Play
1. **Host the Game:** Open the game link on your laptop/desktop.
2. **Join the Room:** Grab your smartphone, scan the QR code on the screen, and enter your racer name (e.g., "Shadow").
3. **Race!:** Look at the big screen and use your phone to steer and deploy items! 

## 💻 Local Development
If you want to run this locally:
```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/neon-kart-chaos.git
cd neon-kart-chaos

# 2. Install dependencies
npm install

# 3. Add your environment variables (You need an Ably API Key)
# Create a .env file and add: VITE_ABLY_KEY=your_key_here

# 4. Start the dev server
npm run dev
```

---
*Created as an exploration into the power of AI prompting.*
