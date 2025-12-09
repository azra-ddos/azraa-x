{
  "functions": {
    "app/index.js": {
      "runtime": "nodejs18.x",
      "maxDuration": 60
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/app/index.js" }
  ]
}