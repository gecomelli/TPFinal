(function() {
  var loginView = document.getElementById('login-view');
  var adminView = document.getElementById('admin-view');
  var editorView = document.getElementById('editor-view');
  var loginForm = document.getElementById('login-form');
  var electionForm = document.getElementById('election-form');
  var electionList = document.getElementById('election-list');
  var candidateEditorList = document.getElementById('candidate-editor-list');
  var adminMessage = document.getElementById('admin-message');
  var editorMessage = document.getElementById('editor-message');
  var loginMessage = document.getElementById('login-message');
  var logoutButton = document.getElementById('logout-button');
  var emptyState = document.getElementById('empty-state');

  function api(path, options) {
    var requestOptions = Object.assign({ credentials: 'same-origin' }, options || {});
    requestOptions.headers = Object.assign({}, requestOptions.headers || {});
    if (requestOptions.body && typeof requestOptions.body !== 'string') {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(requestOptions.body);
    }
    return fetch('/api/admin' + path, requestOptions).then(function(response) {
      return response.json().catch(function() {
        return {};
      }).then(function(payload) {
        if (!response.ok) {
          throw new Error(payload.error || 'No se pudo completar la operacion.');
        }
        return payload;
      });
    });
  }

  function setMessage(element, text, success) {
    element.textContent = text || '';
    element.classList.toggle('success', Boolean(success));
    element.hidden = !text;
  }

  function showAdmin() {
    loginView.hidden = true;
    editorView.hidden = true;
    adminView.hidden = false;
    logoutButton.hidden = false;
  }

  function localDateTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    var timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
  }

  function readableDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Fecha no disponible'
      : date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function statusLabel(status) {
    return {
      scheduled: 'Programada',
      open: 'Abierta',
      closed: 'Cerrada',
      finalized: 'Finalizada'
    }[status] || 'Sin estado';
  }

  function makeButton(label, className, action) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'button ' + className;
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  function renderElection(election) {
    var card = document.createElement('article');
    var main = document.createElement('div');
    var title = document.createElement('h2');
    var description = document.createElement('p');
    var meta = document.createElement('div');
    var candidates = document.createElement('p');
    var actions = document.createElement('div');
    card.className = 'election-card';
    main.className = 'election-card-main';
    title.textContent = election.title;
    description.textContent = election.description;
    meta.className = 'election-meta';

    var status = document.createElement('span');
    status.className = 'pill pill-' + election.status;
    status.textContent = statusLabel(election.status);
    meta.appendChild(status);
    var dates = document.createElement('span');
    dates.className = 'pill';
    dates.textContent = readableDate(election.startsAt) + ' — ' + readableDate(election.endsAt);
    meta.appendChild(dates);
    candidates.className = 'candidate-summary';
    var candidateCount = election.candidates.length;
    var voteCount = election.candidates.reduce(function(total, candidate) {
      return total + (Number(candidate.votes) || 0);
    }, 0);
    candidates.textContent = candidateCount + (candidateCount === 1 ? ' candidatura' : ' candidaturas') +
      ' · ' + voteCount + (voteCount === 1 ? ' voto registrado' : ' votos registrados');
    main.append(title, description, meta, candidates);

    actions.className = 'election-actions';
    actions.appendChild(makeButton('Editar', 'button-quiet', function() {
      openEditor(election);
    }));
    actions.appendChild(makeButton('Borrar', 'button-danger', function() {
      var warning = voteCount
        ? '\n\nLa encuesta tiene ' + voteCount + ' votos; al borrarla se perderan sus resultados.'
        : '';
      if (!window.confirm('¿Borrar la encuesta "' + election.title + '"?' + warning)) {
        return;
      }
      api('/elections/' + election._id, { method: 'DELETE' })
        .then(function() {
          setMessage(adminMessage, 'La encuesta se borro correctamente.', true);
          return loadElections();
        })
        .catch(function(error) { setMessage(adminMessage, error.message); });
    }));
    card.append(main, actions);
    return card;
  }

  function loadElections() {
    return api('/elections').then(function(data) {
      electionList.replaceChildren();
      data.elections.forEach(function(election) {
        electionList.appendChild(renderElection(election));
      });
      emptyState.hidden = data.elections.length > 0;
      return data;
    });
  }

  function readImageFile(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        var dataUrl = typeof reader.result === 'string' ? reader.result : '';
        var separator = dataUrl.indexOf(',');
        if (separator === -1) {
          reject(new Error('No se pudo leer la imagen seleccionada.'));
          return;
        }
        resolve({
          contentType: file.type,
          data: dataUrl.slice(separator + 1)
        });
      };
      reader.onerror = function() {
        reject(new Error('No se pudo leer la imagen seleccionada.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function addCandidate(candidate) {
    var row = document.createElement('div');
    var nameField = document.createElement('div');
    var descriptionField = document.createElement('div');
    var imageField = document.createElement('div');
    var removeButton = document.createElement('button');
    var nameLabel = document.createElement('label');
    var descriptionLabel = document.createElement('label');
    var imageLabel = document.createElement('label');
    var nameInput = document.createElement('input');
    var descriptionInput = document.createElement('input');
    var imageInput = document.createElement('input');
    var imageFileInput = document.createElement('input');
    var imagePreview = document.createElement('img');
    var votes = Number(candidate && candidate.votes) || 0;

    row.className = 'candidate-editor';
    row.dataset.candidateId = candidate && candidate._id ? candidate._id : '';
    nameField.className = 'field';
    descriptionField.className = 'field';
    imageField.className = 'field field-image';
    nameLabel.textContent = 'Nombre';
    descriptionLabel.textContent = 'Descripcion';
    imageLabel.textContent = 'Ruta local o URL HTTPS (opcional si cargas un archivo)';
    nameInput.maxLength = 100;
    nameInput.required = true;
    nameInput.value = candidate ? candidate.name : '';
    descriptionInput.maxLength = 300;
    descriptionInput.value = candidate ? candidate.description : '';
    imageInput.value = candidate && candidate.image
      ? candidate.image
      : '/images/candidates/default.svg';
    imageInput.setAttribute('aria-label', 'Ruta o URL de imagen');
    imageFileInput.type = 'file';
    imageFileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
    imageFileInput.className = 'candidate-image-file';
    imagePreview.className = 'candidate-image-preview';
    imagePreview.alt = 'Vista previa de imagen de ' + (candidate ? candidate.name : 'la candidatura');
    imagePreview.hidden = true;
    var currentImage = candidate && (candidate.imageUrl || candidate.image);
    if (currentImage) {
      imagePreview.src = currentImage;
      imagePreview.hidden = false;
    }
    imageFileInput.addEventListener('change', function() {
      var file = imageFileInput.files && imageFileInput.files[0];
      if (!file) {
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        imageFileInput.value = '';
        setMessage(editorMessage, 'Cada imagen debe tener un tamaño máximo de 2 MB.');
        return;
      }
      if (row.dataset.previewUrl) {
        URL.revokeObjectURL(row.dataset.previewUrl);
      }
      row.dataset.previewUrl = URL.createObjectURL(file);
      imagePreview.src = row.dataset.previewUrl;
      imagePreview.hidden = false;
      setMessage(editorMessage, '');
    });
    nameField.append(nameLabel, nameInput);
    descriptionField.append(descriptionLabel, descriptionInput);
    var fileLabel = document.createElement('label');
    fileLabel.textContent = 'Cargar imagen (JPEG, PNG, GIF o WebP; hasta 2 MB)';
    imageField.append(imageLabel, imageInput, fileLabel, imageFileInput, imagePreview);

    removeButton.type = 'button';
    removeButton.className = 'button button-danger';
    removeButton.textContent = 'Quitar';
    removeButton.disabled = votes > 0;
    removeButton.setAttribute('aria-label', 'Quitar candidatura ' + (candidate ? candidate.name : 'nueva'));
    removeButton.addEventListener('click', function() {
      if (row.dataset.previewUrl) {
        URL.revokeObjectURL(row.dataset.previewUrl);
      }
      row.remove();
    });
    row.append(nameField, descriptionField, removeButton, imageField);
    if (votes > 0) {
      var voteInfo = document.createElement('small');
      voteInfo.className = 'candidate-votes';
      voteInfo.textContent = votes + (votes === 1 ? ' voto registrado; no se puede quitar.' : ' votos registrados; no se puede quitar.');
      row.appendChild(voteInfo);
    }
    candidateEditorList.appendChild(row);
  }

  function openEditor(election) {
    setMessage(editorMessage, '');
    electionForm.reset();
    Array.prototype.forEach.call(
      candidateEditorList.querySelectorAll('.candidate-editor'),
      function(row) {
        if (row.dataset.previewUrl) {
          URL.revokeObjectURL(row.dataset.previewUrl);
        }
      }
    );
    candidateEditorList.replaceChildren();
    document.getElementById('election-id').value = election ? election._id : '';
    document.getElementById('election-title').value = election ? election.title : '';
    document.getElementById('election-description').value = election ? election.description : '';
    document.getElementById('starts-at').value = election ? localDateTime(election.startsAt) : '';
    document.getElementById('ends-at').value = election ? localDateTime(election.endsAt) : '';
    document.getElementById('election-status').value = election ? election.status : 'scheduled';
    document.getElementById('editor-title').textContent = election ? 'Editar encuesta' : 'Nueva encuesta';
    document.getElementById('save-election-button').textContent = election ? 'Guardar cambios' : 'Crear encuesta';
    if (election) {
      election.candidates.forEach(addCandidate);
    } else {
      addCandidate(null);
    }
    adminView.hidden = true;
    editorView.hidden = false;
    window.scrollTo(0, 0);
  }

  function showLoginMessage(text) {
    setMessage(loginMessage, text);
  }

  loginForm.addEventListener('submit', function(event) {
    event.preventDefault();
    showLoginMessage('');
    var submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    api('/login', {
      method: 'POST',
      body: { password: document.getElementById('admin-password').value }
    }).then(function() {
      document.getElementById('admin-password').value = '';
      showAdmin();
      return loadElections().catch(function(error) {
        setMessage(adminMessage, error.message);
      });
    }).catch(function(error) {
      showLoginMessage(error.message);
    }).finally(function() {
      submitButton.disabled = false;
    });
  });

  document.getElementById('new-election-button').addEventListener('click', function() {
    openEditor(null);
  });
  document.getElementById('add-candidate-button').addEventListener('click', function() {
    addCandidate(null);
  });
  document.getElementById('cancel-editor-button').addEventListener('click', function() {
    editorView.hidden = true;
    adminView.hidden = false;
  });
  document.getElementById('cancel-editor-bottom').addEventListener('click', function() {
    editorView.hidden = true;
    adminView.hidden = false;
  });
  logoutButton.addEventListener('click', function() {
    api('/logout', { method: 'POST' }).then(function() {
      adminView.hidden = true;
      editorView.hidden = true;
      loginView.hidden = false;
      logoutButton.hidden = true;
      setMessage(adminMessage, '');
    }).catch(function(error) {
      setMessage(adminMessage, error.message);
    });
  });

  electionForm.addEventListener('submit', function(event) {
    event.preventDefault();
    setMessage(editorMessage, '');
    var rows = Array.prototype.slice.call(
      candidateEditorList.querySelectorAll('.candidate-editor')
    );
    var electionId = document.getElementById('election-id').value;
    var saveButton = document.getElementById('save-election-button');
    saveButton.disabled = true;
    Promise.all(rows.map(function(row) {
      var fields = row.querySelectorAll('input');
      var candidate = {
        name: fields[0].value,
        description: fields[1].value,
        image: fields[2].value
      };
      if (row.dataset.candidateId) {
        candidate._id = row.dataset.candidateId;
      }
      var file = fields[3].files && fields[3].files[0];
      return file
        ? readImageFile(file).then(function(imageUpload) {
          candidate.imageUpload = imageUpload;
          return candidate;
        })
        : candidate;
    })).then(function(candidates) {
      var data = {
        title: document.getElementById('election-title').value,
        description: document.getElementById('election-description').value,
        startsAt: new Date(document.getElementById('starts-at').value).toISOString(),
        endsAt: new Date(document.getElementById('ends-at').value).toISOString(),
        status: document.getElementById('election-status').value,
        candidates: candidates
      };
      return api(electionId ? '/elections/' + electionId : '/elections', {
        method: electionId ? 'PUT' : 'POST',
        body: data
      });
    }).then(function() {
      editorView.hidden = true;
      adminView.hidden = false;
      setMessage(adminMessage, electionId ? 'Se guardaron los cambios.' : 'Se creo la encuesta.', true);
      return loadElections();
    }).catch(function(error) {
      setMessage(editorMessage, error.message);
    }).finally(function() {
      saveButton.disabled = false;
    });
  });

  api('/session').then(function() {
    showAdmin();
    return loadElections().catch(function(error) {
      setMessage(adminMessage, error.message);
    });
  }).catch(function(error) {
    loginView.hidden = false;
    if (error.message !== 'Inicia sesion para administrar las encuestas.') {
      showLoginMessage(error.message);
    }
  });
}());
