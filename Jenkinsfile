pipeline {
    agent any

    environment {
        IMAGE_NAME = 'cloudlet' // Local Docker image name
        IMAGE_TAG = 'latest'
        CONTAINER_NAME = 'cloudlet-container' // Name of the running container
    }

    stages {
        stage('Checkout Code') {
            steps {
                // Clone the repository
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    // Build the Docker image
                    sh 'docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .'

                    // Run a temporary container for smoke testing
                    sh '''
                    docker run --name temp-${CONTAINER_NAME} -d -p 8081:80 ${IMAGE_NAME}:${IMAGE_TAG}
                    sleep 5 # Wait for the container to start
                    '''

                    sh '''
                    curl -s http://localhost:8081 | grep -q "CloudLet" || (docker logs temp-${CONTAINER_NAME} && docker stop temp-${CONTAINER_NAME} && docker rm temp-${CONTAINER_NAME} && exit 1)
                    '''

                    // Stop and remove the temporary container after the test
                    sh '''
                    docker stop temp-${CONTAINER_NAME}
                    docker rm temp-${CONTAINER_NAME}
                    '''
                }
            }
        }

        stage('Stop Existing Container') {
            steps {
                script {
                    // Stop and remove the existing container if it is running
                    sh '''
                    if [ $(docker ps -q -f name=${CONTAINER_NAME}) ]; then
                        docker stop ${CONTAINER_NAME}
                        docker rm ${CONTAINER_NAME}
                    fi
                    '''
                }
            }
        }

        stage('Run New Container') {
            steps {
                script {
                    // Run the new container
                    sh '''
                    docker run -d --name ${CONTAINER_NAME} -p 80:80 ${IMAGE_NAME}:${IMAGE_TAG}
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Application successfully built, tested, and hosted!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
