const routes = [
    'R001', 'R002', 'R003', 'R004', 'R005', 'R006', 'R007', 'R008', 'R009', 'R010',
    'R011', 'R012', 'R013', 'R014', 'R015', 'R016', 'R017', 'R018', 'R019', 'R020',
    'R021', 'R022', 'R023', 'R024', 'R025', 'R026', 'R027', 'R028', 'R030', 'R031',
    'R032', 'R033', 'R033A', 'R034', 'R035', 'R036', 'R037', 'R038', 'R039', 'R040',
    'R041', 'R042', 'Zone001'
];

document.getElementById('processButton').addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    const files = Array.from(fileInput.files);

    if (files.length !== 1) {
        alert('Please upload exactly one CSV file.');
        return;
    }

    readAndProcessCSV(files[0]).then(({ groupedData, routeName }) => {
        const sortedOutputs = document.getElementById('sortedOutputs');
        const memberChangesOutputs = document.getElementById('memberChangesOutputs');
        const downloadButton = document.getElementById('downloadButton');
        sortedOutputs.innerHTML = '';
        memberChangesOutputs.innerHTML = '';
        downloadButton.classList.add('hidden');

        let memberChangesCSV = 'Change Type,Member,Session,Current Date,Previous Date\n';

        // Process each session group
        Object.keys(groupedData).forEach(session => {
            const dataByDate = groupedData[session];
            const sortedDates = Object.keys(dataByDate).sort((a, b) => new Date(a) - new Date(b));

            sortedDates.forEach((date, index) => {
                const outputId = `output_${session}_${index + 1}`;
                sortedOutputs.innerHTML += `
                    <h3>Sorted CSV (${date}, ${session}) for Route: ${routeName}</h3>
                    <button class="toggle-button" onclick="toggleVisibility('${outputId}')">View</button>
                    <pre id="${outputId}" class="hidden"></pre>`;
                displayCSV(dataByDate[date], Object.keys(dataByDate[date][0]), outputId);
            });

            // Find missing and new members between consecutive dates within the same session
            memberChangesOutputs.innerHTML += `<h3>Member changes in ${session} session for Route: ${routeName}</h3>`;
            for (let i = 0; i < sortedDates.length - 1; i++) {
                const currentDate = sortedDates[i + 1];
                const previousDate = sortedDates[i];

                // Missing members
                const missingMembers = findMissingMembers(dataByDate[previousDate], dataByDate[currentDate]);
                const missingOutputId = `missingMembers_${session}_${i + 1}`;
                memberChangesOutputs.innerHTML += `<h4>Changes on ${currentDate} (compared to ${previousDate}):</h4>`;
                memberChangesOutputs.innerHTML += `<table id="${missingOutputId}"><tr><th class="missing-header">Missing Members</th><th class="missing-header">Session</th></tr></table>`;
                displayMissingMembers(missingMembers, missingOutputId, previousDate, dataByDate[previousDate]);

                // Add to CSV for missing members
                missingMembers.forEach(([member, session]) => {
                    memberChangesCSV += `Missing,${member},${session},${currentDate},${previousDate}\n`;
                });

                // New members
                const newMembers = findNewMembers(dataByDate[previousDate], dataByDate[currentDate]);
                const newMembersOutputId = `newMembers_${session}_${i + 1}`;
                memberChangesOutputs.innerHTML += `<table id="${newMembersOutputId}"><tr><th class="new-header">New Members</th><th class="new-header">Session</th></tr></table>`;
                displayNewMembers(newMembers, newMembersOutputId, currentDate, dataByDate[currentDate]);

                // Add to CSV for new members
                newMembers.forEach(([member, session]) => {
                    memberChangesCSV += `New,${member},${session},${currentDate},${previousDate}\n`;
                });
            }
        });

        // Enable download button and set CSV data
        downloadButton.classList.remove('hidden');
        downloadButton.onclick = () => downloadCSV(memberChangesCSV, `${routeName}_member_changes.csv`);
    }).catch(error => {
        console.error(error);
        alert('An error occurred while processing the file.');
    });
});

function readAndProcessCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(event) {
            const csvData = event.target.result;

            Papa.parse(csvData, {
                header: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                        console.error('CSV parsing errors:', results.errors);
                        reject('Errors encountered while parsing CSV file.');
                        return;
                    }

                    const data = results.data;
                    const memberIndex = results.meta.fields.indexOf("Member");
                    const dateIndex = results.meta.fields.indexOf("Date");
                    const sessionIndex = results.meta.fields.indexOf("Session");
                    const routeIndex = results.meta.fields.indexOf("Route");

                    if (memberIndex === -1 || dateIndex === -1 || sessionIndex === -1 || routeIndex === -1) {
                        reject('Required columns ("Member", "Date", "Session", "Route") not found in the CSV file.');
                        return;
                    }

                    const groupedData = data.reduce((acc, row) => {
                        const date = row["Date"];
                        const session = row["Session"];

                        if (!acc[session]) {
                            acc[session] = {};
                        }
                        if (!acc[session][date]) {
                            acc[session][date] = [];
                        }
                        acc[session][date].push(row);
                        return acc;
                    }, {});

                    const routeName = data[0]["Route"];

                    if (!routes.includes(routeName)) {
                        reject('Invalid route name.');
                        return;
                    }

                    resolve({ groupedData, routeName });
                }
            });
        };

        reader.onerror = function(event) {
            console.error('FileReader error:', event.target.error);
            reject('Unable to read the CSV file.');
        };

        reader.readAsText(file);
    });
}

function toggleVisibility(id) {
    const element = document.getElementById(id);
    if (element.classList.contains('hidden')) {
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
    }
}

function displayCSV(data, headers, outputId) {
    const table = `<table><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>${data.map(row => `<tr>${headers.map(header => `<td>${row[header]}</td>`).join('')}</tr>`).join('')}</table>`;
    document.getElementById(outputId).innerHTML = table;
}

function findMissingMembers(previousData, currentData) {
    const previousMembers = new Set(previousData.map(row => row['Member']));
    return currentData.filter(row => !previousMembers.has(row['Member'])).map(row => [row['Member'], row['Session']]);
}

function findNewMembers(previousData, currentData) {
    const currentMembers = new Set(currentData.map(row => row['Member']));
    return previousData.filter(row => !currentMembers.has(row['Member'])).map(row => [row['Member'], row['Session']]);
}

function displayMissingMembers(missingMembers, outputId, previousDate, previousData) {
    const tableRows = missingMembers.map(([member, session]) => {
        const matchingRow = previousData.find(row => row['Member'] === member && row['Session'] === session);
        return `<tr><td>${member}</td><td>${session}</td></tr>`;
    }).join('');
    document.getElementById(outputId).innerHTML += tableRows;
}

function displayNewMembers(newMembers, outputId, currentDate, currentData) {
    const tableRows = newMembers.map(([member, session]) => {
        const matchingRow = currentData.find(row => row['Member'] === member && row['Session'] === session);
        return `<tr><td>${member}</td><td>${session}</td></tr>`;
    }).join('');
    document.getElementById(outputId).innerHTML += tableRows;
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}
