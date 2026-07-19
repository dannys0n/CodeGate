@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo CodeGate release publisher
echo.

where git.exe >nul 2>nul
if errorlevel 1 (
    echo Git was not found on PATH.
    exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found on PATH.
    exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo npm was not found on PATH.
    exit /b 1
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if not defined BRANCH (
    echo Unable to determine the current Git branch.
    exit /b 1
)
if /i not "%BRANCH%"=="main" (
    echo Releases must be created from main. Current branch: %BRANCH%
    exit /b 1
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo This repository does not have an origin remote.
    exit /b 1
)

for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "CURRENT_VERSION=%%V"
if not defined CURRENT_VERSION (
    echo Unable to read the current package version.
    exit /b 1
)

echo Current version: %CURRENT_VERSION%
echo Current changes that will be included in the release commit:
git status --short
echo.
echo Choose the version increment:
echo   [P] Patch  - fixes and small changes
echo   [M] Minor  - backward-compatible features
echo   [J] Major  - breaking changes
echo   [X] Cancel
choice /C PMJX /N /M "Selection: "
if errorlevel 4 exit /b 0
if errorlevel 3 set "BUMP=major"
if errorlevel 2 set "BUMP=minor"
if errorlevel 1 set "BUMP=patch"

echo.
set "RELEASE_NOTE="
set /p "RELEASE_NOTE=Release note (optional, one line): "

echo.
echo This will include ALL files shown above, increment the %BUMP% version,
echo create a release commit and annotated tag, then push both to origin.
echo Any release note entered above will appear before the generated changelog.
echo Pushing the tag will trigger the GitHub Actions release build.
choice /C YN /N /M "Continue? [Y/N]: "
if errorlevel 2 exit /b 0

echo.
echo Checking the working tree...
git diff --check
if errorlevel 1 (
    echo Fix the errors above before publishing.
    exit /b 1
)

echo.
echo Running type and application checks...
call npm.cmd run check
if errorlevel 1 (
    echo Release checks failed. No version change was made.
    exit /b 1
)

call npm.cmd test -- --run
if errorlevel 1 (
    echo Release tests failed. No version change was made.
    exit /b 1
)

echo.
echo Updating package versions...
call npm.cmd version %BUMP% --no-git-tag-version
if errorlevel 1 exit /b 1

for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "NEW_VERSION=%%V"
if not defined NEW_VERSION (
    echo The version changed, but the new version could not be read. Nothing was committed.
    exit /b 1
)
set "RELEASE_TAG=v%NEW_VERSION%"

git rev-parse -q --verify "refs/tags/%RELEASE_TAG%" >nul 2>nul
if not errorlevel 1 (
    echo Tag %RELEASE_TAG% already exists. Nothing was committed.
    exit /b 1
)

echo.
echo Creating release commit %RELEASE_TAG%...
git add -A
git commit -m "Release %RELEASE_TAG%"
if errorlevel 1 (
    echo Commit failed. The version change remains in the working tree for inspection.
    exit /b 1
)

set "TAG_MESSAGE_FILE=%TEMP%\codegate-tag-%RANDOM%-%RANDOM%.txt"
node -e "const fs=require('fs'); const title='CodeGate '+process.env.RELEASE_TAG; const note=(process.env.RELEASE_NOTE||'').trim(); fs.writeFileSync(process.env.TAG_MESSAGE_FILE, title+(note?'\n\n'+note:'')+'\n', 'utf8');"
if errorlevel 1 (
    del /q "%TAG_MESSAGE_FILE%" >nul 2>nul
    echo Unable to prepare the annotated tag message. The release commit exists locally but was not tagged.
    exit /b 1
)

git tag -a "%RELEASE_TAG%" -F "%TAG_MESSAGE_FILE%"
set "TAG_RESULT=%ERRORLEVEL%"
del /q "%TAG_MESSAGE_FILE%" >nul 2>nul
if not "%TAG_RESULT%"=="0" (
    echo Tag creation failed. The release commit exists locally but was not pushed.
    exit /b 1
)

echo.
echo Pushing main and %RELEASE_TAG% to origin...
git push --atomic origin main "%RELEASE_TAG%"
if errorlevel 1 (
    echo Push failed. The release commit and tag remain local and can be retried with:
    echo   git push --atomic origin main %RELEASE_TAG%
    exit /b 1
)

echo.
echo Published %RELEASE_TAG%.
echo GitHub Actions will now build and publish the Windows release.
exit /b 0
