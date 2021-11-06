# CLI Tools

A set of useful command line interface tools

## Usage

This project contains utility command line interface tools.  To setup a PC so
that you can execute them from any directory, do the following.

1. Install dependencies.

   ```powershell
   npm install
   ```

2. Build and copy the output to the `dist-saved` directory.  This directory
   serves as a stable location for the last known good (i.e. published) version
   of these tools.

   ```powershell
   gulp build && gulp updateDistSaved
   ```

3. Add the `dist-saved\src` folder to the path environment variable:

    ```powershell
    $env:path += ";C:\<path>\<to>\clitools\dist-saved\src;"
    ```
