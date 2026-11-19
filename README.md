# SplitEasy

Splitwise-style expense splitting. Static PWA (GitHub Pages) + Firebase Auth/Firestore (Spark plan, no Cloud Functions).
Single currency (change `CURRENCY` in `src/money.ts`). Split types: equal and exact.

## Firebase setup (once)
1. Console > create project > Build > **Authentication** > enable **Google**.
2. Build > **Firestore Database** > create (production mode).
3. Authentication > Settings > **Authorized domains** > add `swamiworld.github.io`.
4. Project settings > Your apps > add **Web app** > copy config into `src/firebaseConfig.ts`.
5. Publish rules: `npm i -g firebase-tools && firebase login && firebase use <project-id> && firebase deploy --only firestore:rules`
   (or paste `firestore.rules` into the console Rules tab).

## Develop
```
npm install
npm run dev     # http://localhost:5173
npm test
```

## Deploy
Create repo `swamiworld/spliteasy`, push to `main`, and set Settings > Pages > Source = **GitHub Actions**.
App URL: `https://swamiworld.github.io/spliteasy/`

## Invites
Group page > "Copy invite link". Opening it (signed in) adds you to the group.
