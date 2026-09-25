@echo off
rem Wraith Core: trust the launcher's code-signing certificate for this Windows user (run once).
rem Adds the public certificate "CN=Wraith Core" to your Trusted Root and Trusted Publishers stores.
rem It is limited to Code Signing: it cannot vouch for websites. Remove it any time from certmgr.msc.
setlocal
set "CER=%TEMP%\WraithCore-CodeSigning.cer"
set "B64=%TEMP%\WraithCore-CodeSigning.b64"
> "%B64%" echo -----BEGIN CERTIFICATE-----
>> "%B64%" echo MIIEKDCCApCgAwIBAgIQI1JWNoe4gIFAKM/sUfUjkTANBgkqhkiG9w0BAQsFADAs
>> "%B64%" echo MRQwEgYDVQQKDAtXcmFpdGggQ29yZTEUMBIGA1UEAwwLV3JhaXRoIENvcmUwHhcN
>> "%B64%" echo MjYwOTI1MTQ0NjQ2WhcNMzYwOTI1MTQ1NjQ2WjAsMRQwEgYDVQQKDAtXcmFpdGgg
>> "%B64%" echo Q29yZTEUMBIGA1UEAwwLV3JhaXRoIENvcmUwggGiMA0GCSqGSIb3DQEBAQUAA4IB
>> "%B64%" echo jwAwggGKAoIBgQC+dx2dEZTEYNe3MJxF47xaAvcctDIc7HhJuZKihVOIZPeXk97+
>> "%B64%" echo cG89YM/BKQnaQspg2b6yuMGbiuZ5XLzWCOnuOymiV6J3t8MWRL71Hs/IYHmxjb2Q
>> "%B64%" echo 93eNTFzBTZ93sy2WhbGso7GEmwjyxU7W4c6CSXdABC60xFtZpPWH8usNBiXQZhfc
>> "%B64%" echo arwxZfyeaR+4A/kQq2nli2U88XTfZOJ7dvjeQoz6YyFxEsXg8DFb/pvB7WioVrd5
>> "%B64%" echo D91gS6ABmowyn7VJTI4qQQmWLN0ih19Ip/L6IaCQRMWSUK8nFWOUx/0HbmxXPqEs
>> "%B64%" echo U7q285dvHWWVZwr6XuQJU6QTE6OBj2LuagjblV9HsKP5YLqJgE0oZSFuRxJvS2EV
>> "%B64%" echo DVdbSXQp5ETHwbhyyE9HISYBtxXhBLC3snxcZUWKQ2BSM92/HNjD2PhSUT0QZnUG
>> "%B64%" echo GDuzjU9nkNVQJc2HfoKUMtO1hJNyihFZUPU3o2vJbDt3IQ1i1l9PBVOUXMJRntaC
>> "%B64%" echo TzBQF9cxxANnq7ECAwEAAaNGMEQwDgYDVR0PAQH/BAQDAgeAMBMGA1UdJQQMMAoG
>> "%B64%" echo CCsGAQUFBwMDMB0GA1UdDgQWBBTHBaOGgJC5kPFVNs2QOc1hagc+fzANBgkqhkiG
>> "%B64%" echo 9w0BAQsFAAOCAYEAPBXZ730RwIJ1etmO3YG6iw0odu8rJbyv0F0WkN/v/3MQgfc/
>> "%B64%" echo 1eKYPHiWOGEim1ssYnsWEt4qlyWYs7O+fvXA9XQ6+y/eR4LXcVoxPh5pDMu6Peui
>> "%B64%" echo ZUTqAAxHZ945KFoXDh47oK5x9nJCaU3lY9WjnC/eWRHNxCxSH57uPOHmocmQrkTh
>> "%B64%" echo XMoMe2oEVa/uMlQgM855E/GPJhsuhmPtGX1v78ZzzYPC/1LgUwLqhzUg+7a1ek8l
>> "%B64%" echo 1fdn5373GNCuXKcxOPNc4gGIw5HCcC1tzNI9XACHhv71MTqM7bAVluWjMPVsiPWN
>> "%B64%" echo jXm5E9pgNeF/RV7lK04omSIWf8dX/8dYW3+5My3CC0+6zEUOwqx5zExGWNucxjR+
>> "%B64%" echo dB/qCnMAGrdunBT6Zk3TGH1vCYSXe8RTyBgvyNyBEAqiNpGFi/pzQc1TbuSPQ0M+
>> "%B64%" echo PwCCukoCYI6lEnen39cSHvyBZQPgSCQejG8kbfZlZpBwsvqHbFcX400SanBxsU0+
>> "%B64%" echo eKTSdeOLKLU8XJDG
>> "%B64%" echo -----END CERTIFICATE-----
certutil -f -decode "%B64%" "%CER%" >nul
echo.
echo  Windows will ask you to confirm the "Wraith Core" certificate. Press YES.
echo.
certutil -user -addstore Root "%CER%" >nul
certutil -user -addstore TrustedPublisher "%CER%" >nul
del /q "%B64%" "%CER%" >nul 2>&1
echo  Done. You can now install and run the Wraith Core launcher.
echo.
pause
