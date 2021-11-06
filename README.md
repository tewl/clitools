# CLI Tools

A set of useful command line interface tools

## Usage

This project contains utility command line interface tools.  To setup a PC so
that you can execute them from any directory, do the following.

1. Build this project.  When finished, copy the `dist` folder to `dist-saved`.

   Note:  On Windows, this will also create `.cmd` files for each executable
   script.  This will allow you to enter just the script's name (without the
   extension).

2. Add the `dist-saved\src` folder to the path environment variable:

    ```powershell
    $env:path += ";C:\<path>\<to>\clitools\dist-saved\src;"
    ```
