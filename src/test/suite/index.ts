import Mocha from 'mocha';
import * as fs from 'fs';
import * as path from 'path';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname, '.');

    try {
        const files = fs.readdirSync(testsRoot)
            .filter(file => file.endsWith('.test.js'));

        // Add files to the test suite
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        return new Promise<void>((resolve, reject) => {
            try {
                // Run the mocha test
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    } catch (err) {
        console.error('Error finding test files:', err);
        throw err;
    }
}