// Establish a WebSocket connection to the server
const socket = new WebSocket('ws://localhost:3000/ws');

// Listen for messages from the server
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    //TODO: Handle the events from the socket
    switch (data.type) {
        case 'newPoll':
            onNewPollAdded(data.poll);
            break;
        case 'voteUpdate':
            onIncomingVote(data.pollId, data.votes);
            break;
        case 'voteClicked':
            onVoteClicked(data.poll);
            break;
    }
});


/**
 * Handles adding a new poll to the page when one is received from the server
 * 
 * @param {*} data The data from the server (ideally containing the new poll's ID and it's corresponding questions)
 */
function onNewPollAdded(data) {
    // Create a new DOM element for the poll
    const pollContainer = document.getElementById('polls');
    const newPoll = document.createElement('div');
    newPoll.classList.add('poll'); // Add a CSS class for styling

    // Extract poll information from the data (assuming data contains question and options)
    const { question, options } = data;

    // Add poll content to the new element
    newPoll.innerHTML = `<h3>${question}</h3>`;
    const form = document.createElement('form');
    form.classList.add('poll-form'); // Add a CSS class for styling
    options.forEach(option => {
        const label = document.createElement('label');
        label.textContent = option;
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'vote'; // Use the same name for all radio buttons in the poll
        radio.value = option; // Set radio button value to the option text
        label.appendChild(radio);
        form.appendChild(label);
    });
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Vote';
    form.appendChild(submitButton);
    newPoll.appendChild(form);

    // Append the new poll to the container and add event listener to the form
    pollContainer.appendChild(newPoll);
    form.addEventListener('submit', onVoteClicked);
}

/**
 * Handles updating the number of votes an option has when a new vote is recieved from the server
 * 
 * @param {*} data The data from the server (probably containing which poll was updated and the new vote values for that poll)
 */
function onIncomingVote(data) {
    // Extract poll ID and updated vote counts from the data
    const { pollId, votes } = data;

    // Find the DOM element for the updated poll
    const pollElement = document.querySelector(`.poll[data-poll-id="${pollId}"]`);
    if (!pollElement) return; // Poll element not found

    // Update vote counts for each option
    pollElement.querySelectorAll('.poll-form input[type="radio"]').forEach(radio => {
        const optionValue = radio.value;
        const voteCountElement = pollElement.querySelector(`span[data-option="${optionValue}"]`);
        if (voteCountElement) {
            voteCountElement.textContent = `(${votes[optionValue]})`;
        }
    });
}

/**
 * Handles processing a user's vote when they click on an option to vote
 * 
 * @param {FormDataEvent} event The form event sent after the user clicks a poll option to "submit" the form
 */
function onVoteClicked(event) {
    event.preventDefault(); // Prevent default form submission

    const formData = new FormData(event.target);
    const pollId = formData.get('poll-id');
    const selectedOption = formData.get('vote');

    // Send vote information to the server
    socket.send(JSON.stringify({ type: 'vote', pollId, selectedOption }));
}

//Adds a listener to each existing poll to handle things when the user attempts to vote
$(document).ready(function() {
    $('.vote-button').on('click', function() {
      const pollId = $(this).data('poll-id');
      const option = $(this).data('option');
      const isVoted = $(this).data('voted');
  
      if (!isVoted) {
        $.ajax({
          url: '/vote',
          method: 'POST',
          data: { pollId, option },
          success: (response) => {
            // Update the UI to reflect the new vote count and disable the button
            $(this).prop('disabled', true);
            $(this).text('Voted');
          },
          error: (error) => {
            console.error('Error voting:', error);
            // Handle error, e.g., display an error message to the user
          }
        });
      } else {
        alert('You have already voted on this poll.');
      }
    });
  });
