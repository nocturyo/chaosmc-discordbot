cd "C:\Users\Administrator\Desktop\chaosmc-bot"

# 1. zatrzymaj usługę
nssm stop ChaosMCBot

# 2. weź najnowszy kod
git fetch --all
git reset --hard origin/main   # lub: origin/master / branch, którego używasz

# 3. zainstaluj zależności dokładnie wg package-lock.json
npm ci

# 4. build
npm run build

# 5. (opcjonalnie) rejestracja slashów – tylko gdy zmieniałeś komendy
npm run register

# 6. start usługi
nssm start ChaosMCBot

# 7. log na żywo
Get-Content .\logs\out.log -Wait
