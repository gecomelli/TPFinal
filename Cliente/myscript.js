(function() {
  var originInput = document.getElementById('api-origin');
  var loadButton = document.getElementById('load-elections');
  var electionSelect = document.getElementById('election');
  var candidateSelect = document.getElementById('candidate');
  var voteForm = document.getElementById('vote-form');
  var submitButton = document.getElementById('submit-vote');
  var status = document.getElementById('status');
  var response = document.getElementById('response');
  var elections = [];

  originInput.value = window.location.origin;

  function apiUrl(path) {
    var origin;
    try {
      origin = new URL(originInput.value.trim());
    } catch (error) {
      throw new Error('Ingresa una dirección válida para la API.');
    }
    if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
      throw new Error('La dirección de la API debe usar HTTP o HTTPS.');
    }
    return origin.origin + '/api/v1' + path;
  }

  function request(path, options) {
    return fetch(apiUrl(path), options).then(function(result) {
      return result.json().catch(function() {
        return {};
      }).then(function(payload) {
        if (!result.ok) {
          throw new Error(payload.error || 'La API devolvió un error.');
        }
        return payload;
      });
    });
  }

  function showResult(message, payload) {
    status.textContent = message || '';
    response.textContent = payload ? JSON.stringify(payload, null, 2) : '';
    response.hidden = !payload;
  }

  function updateCandidates() {
    var election = elections.find(function(item) {
      return item.id === electionSelect.value;
    });
    candidateSelect.replaceChildren();
    if (!election || !election.candidates.length) {
      candidateSelect.add(new Option('No hay candidaturas disponibles', ''));
      candidateSelect.disabled = true;
      submitButton.disabled = true;
      return;
    }
    election.candidates.forEach(function(candidate) {
      candidateSelect.add(new Option(candidate.name, candidate.id));
    });
    candidateSelect.disabled = false;
    submitButton.disabled = false;
  }

  loadButton.addEventListener('click', function() {
    showResult('Consultando encuestas activas…');
    electionSelect.disabled = true;
    candidateSelect.disabled = true;
    submitButton.disabled = true;
    request('/encuestas')
      .then(function(payload) {
        elections = payload.elections || [];
        electionSelect.replaceChildren();
        if (!elections.length) {
          electionSelect.add(new Option('No hay encuestas activas', ''));
          showResult('No se encontraron encuestas activas.', payload);
          return;
        }
        elections.forEach(function(election) {
          electionSelect.add(new Option(election.title, election.id));
        });
        electionSelect.disabled = false;
        updateCandidates();
        showResult('Se encontraron ' + elections.length + ' encuesta(s) activa(s).', payload);
      })
      .catch(function(error) {
        showResult(error.message);
      });
  });

  electionSelect.addEventListener('change', updateCandidates);

  voteForm.addEventListener('submit', function(event) {
    event.preventDefault();
    var electionId = electionSelect.value;
    if (!electionId) {
      showResult('Selecciona una encuesta activa.');
      return;
    }

    var voter = {
      dni: document.getElementById('dni').value,
      fullName: document.getElementById('full-name').value,
      sex: document.getElementById('sex').value,
      age: Number(document.getElementById('age').value),
      email: document.getElementById('email').value,
      educationLevel: document.getElementById('education').value
    };
    var apiKey = document.getElementById('api-key').value;
    submitButton.disabled = true;
    showResult('Enviando voto…');
    request('/encuestas/' + encodeURIComponent(electionId) + '/votos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        candidateId: candidateSelect.value,
        voter: voter
      })
    }).then(function(payload) {
      showResult(payload.message || 'Voto registrado.', payload);
      document.getElementById('api-key').value = '';
    }).catch(function(error) {
      showResult(error.message);
    }).finally(function() {
      submitButton.disabled = false;
    });
  });
})();
