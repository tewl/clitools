# CLI Tools

A set of useful command line interface tools

## Usage

This project contains utility command line interface tools.  To setup a PC so
that you can execute them from any directory, do the following.

1. Install dependencies and build.

   Note:  On Windows, this will also create `.cmd` files for each executable
   script.  This will allow you to enter just the script's name (without the
   extension).

   ```powershell
   npm install
   gulp build
   ```

2. Run the npm script, to copy the build files into the `dist-saved` directory.

   ```powershell
   gulp updateDistSaved
   ```

3. Add the `dist-saved\src` folder to the path environment variable:

    ```powershell
    $env:path += ";C:\<path>\<to>\clitools\dist-saved\src;"
    ```
