beforeAll(() =>
{
    console.log("Running Jasmine " + getJasmineVersion() + ".");
});


describe("jasmine", () =>
{

    it("version will be printed while running the unit tests", () =>
    {
        expect(getJasmineVersion()).toBe("3.10.1");
    });


});


function getJasmineVersion(): string
{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (jasmine as any).version || (jasmine.getEnv() as any).versionString();
}
